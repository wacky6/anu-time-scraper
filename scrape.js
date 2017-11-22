const superagent = require('superagent')
const cheerio = require('cheerio')
const { createWriteStream } = require('fs')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/*
 * baseUrl: timetable landing page
 *          eg: 'http://timetabling.anu.edu.au/sws2017/'
 */
function scrapeTimetable(baseUrl) {
    // need agent to preserve cookie
    const agent = superagent.agent()

    return (async function TimetableScrapeExecutor() {
        let state = null
        let progress = 0

        // should get a cookie
        state = 'FETCH_LANDING_PAGE'
        const {
            text: landingPage
        } = await agent.get(baseUrl)
        const landingPage$ = cheerio.load(landingPage)

        // TODO: check that server is working
        console.log('landing page fetched')

        state = 'FETCH_COURSE_LIST'
        const {
            text: courseList
        } = await agent.post(baseUrl)
            .type('form')
            .send({
                __EVENTTARGET:        'LinkBtn_modules',
                __EVENTARGUMENT:      '',
                __VIEWSTATE:          landingPage$('#__VIEWSTATE').val(),
                __VIEWSTATEGENERATOR: landingPage$('#__VIEWSTATEGENERATOR').val(),
                __EVENTVALIDATION:    landingPage$('#__EVENTVALIDATION').val(),
                tLinkType:            'information'
            })
        const courseList$ = cheerio.load(courseList)

        // preserve states
        const __viewState = courseList$('#__VIEWSTATE').val()
        const __viewStateGenerator = courseList$('#__VIEWSTATEGENERATOR').val()
        const __eventValidation = courseList$('#__EVENTVALIDATION').val()

        const courseOptions = courseList$('#dlObject option')
            .toArray()
            .map(courseList$)  // turn into cheerio $ object

        console.log(`found ${courseOptions.length} courses`)

        outf = createWriteStream('./out.ndjson')

        STATE = 'FETCH_COURSE'
        for (let i=0; i!==courseOptions.length; ++i) {
            const courseOption = courseOptions[i]
            const {
                text: coursePage,
                state: coursePageState
            } = await agent.post(baseUrl)
                .type('form')
                .send({
                    __EVENTTARGET:        '',
                    __EVENTARGUMENT:      '',
                    __LASTFOCUS:          '',
                    __VIEWSTATE:          __viewState,
                    __VIEWSTATEGENERATOR: __viewStateGenerator,
                    __EVENTVALIDATION:    __eventValidation,
                    tLinkType:            'modules',
                    dlFilter:             '',
                    tWildcard:            '',
                    dlObject:             courseOption.val(),
                    lbWeeks:              '1-52',
                    lbDays:               '1-7;1;2;3;4;5;6;7',
                    dlPeriod:             '1-32;1;2;3;4;5;6;7;8;9;10;11;12;13;14;15;16;17;18;19;20;21;22;23;24;25;26;27;28;29;30;31;32;',
                    RadioType:            'module_list;cyon_reports_list_url;dummy',
                    bGetTimetable:        'View Timetable'
                })

            const coursePage$ = cheerio.load(coursePage)
            const courseId = courseOption.val().slice(3)
            const rawRows = coursePage$('tbody > tr')
                .toArray()
                .map(el => coursePage$(el).html())
            
            outf.write( JSON.stringify({
                id: courseId,
                state: coursePageState,
                rawRows
            }) )
            
            progress = i / courseOptions.length
            console.log(`${i+1} / ${courseOptions.length}, Scraped ${courseId}, ${rawRows.length} rows`)
        }

        progress = 1
        outf.close()

    })()
}

module.exports = scrapeTimetable

scrapeTimetable('http://timetabling.anu.edu.au/sws2017/')