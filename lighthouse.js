const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const argv = require('yargs').argv; // for using url-path as an argument in terminal
const url = require('url');

const metricFilter = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'speed-index',
    'estimated-input-latency',
    'total-blocking-time',
    'interactive',
    'cumulative-layout-shif'
];

// const launchChromeAndRunLighthouseNew  = async (url) => {
//     const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});
//     const options = {logLevel: 'info', output: 'html', onlyCategories: ['performance'], port: chrome.port};
//     const runnerResult = await lighthouse(url, options);
  
//     // `.report` is the HTML report as a string
//     const reportHtml = runnerResult.report;
//     fs.writeFileSync('lhreport.html', reportHtml);
  
//     // `.lhr` is the Lighthouse Result as a JS object
//     console.log('Report is done for', runnerResult.lhr.finalUrl);
//     console.log('Performance score was', runnerResult.lhr.categories.performance.score * 100);
  
//     await chrome.kill();
// };

const launchChromeAndRunLighthouse = url => {
    return chromeLauncher.launch().then(chrome => {
        const  opts = {
            port: chrome.port,
            onlyCategories: ['performance'],
        };
        return lighthouse(url, opts).then(results => {
            return chrome.kill().then(() => {
                return {
                    js: results.lhr, // return Lighthouse Result Object
                    json: results.report
                };
            });
        });
    });
};

const getContents = pathStr => {
    const output = fs.readFileSync(pathStr, 'utf8', (err, results) => {
        return results;
    });
    return JSON.parse(output);
};

const compareReports = (from, to) => {  
    const calcPercentageDiff = (from, to) => {
      const per = ((to - from) / from) * 100;
      return Math.round(per * 100) / 100;
    };
  
    for (let auditObj in from['audits']) {
        if (metricFilter.includes(auditObj)) {
            const fromNum = from['audits'][auditObj].numericValue;
            const toNum = to['audits'][auditObj].numericValue;        
            const percentageDiff = calcPercentageDiff(fromNum, toNum);

            let logColor = '\x1b[37m';
            const log = (() => {
                if (Math.sign(percentageDiff) === 1) {
                    logColor = '\x1b[31m';
                    return `${percentageDiff.toString().replace('-', '') + '%'} slower`;
                } else if (Math.sign(percentageDiff) === 0) {
                    return 'unchanged';
                } else {
                    logColor = '\x1b[32m';
                    return `${percentageDiff.toString().replace('-', '') + '%'} faster`;
                }
            })();

            console.log(logColor, `${from['audits'][auditObj].title} from ${Math.round(fromNum)} to ${Math.round(toNum)} is ${log}`);
        }
    }
    console.log('\x1b[37m');
};

const compareScores = (res) => {  
    for (let auditObj in res['audits']) {
        if (metricFilter.includes(auditObj)) {
            console.log(auditObj, res['audits'][auditObj].score);        }
    }
};

const rootDirName = 'reports';
if(!fs.existsSync(rootDirName)) {        
    fs.mkdirSync(rootDirName);
}

if (argv.from && argv.to) {
    compareReports(
      getContents(argv.from + '.json'),
      getContents(argv.to + '.json')
    );
} else if (argv.url) {
    const urlOdj = new URL(argv.url);
    
    let dirName = urlOdj.host.replace('www.', '').replace(/:/g, '_');
    if(urlOdj.pathname !== '/') {
        dirName += urlOdj.pathname.replace(/\//g, '_');
    }
    
    const fullDirName = `${rootDirName}/${dirName}`;
    if(!fs.existsSync(fullDirName)) {        
        fs.mkdirSync(fullDirName);
    }

    launchChromeAndRunLighthouse(argv.url).then(results => {        
        const prevReports = glob(`${fullDirName}/*.json`, {sync: true})
        
        // compare with previous report if exists
        if (prevReports.length) {
            dates = [];
            for (report in prevReports) {
              dates.push(
                new Date(path.parse(prevReports[report]).name.replace(/_/g, ':'))
              );
            }
            const max = dates.reduce((a, b) => Math.max(a, b));
            const recentReport = new Date(max).toISOString();           
            const recentReportContents = getContents(fullDirName + '/' + recentReport.replace(/:/g, '_') + '.json');
            compareReports(recentReportContents, results.js);
        }

        compareScores(results.js);
        console.log('Report is done for', results.js.finalUrl);
        console.log('Performance score was', results.js.categories.performance.score * 100);

        fs.writeFile(
            `${fullDirName}/${results.js['fetchTime'].replace(/:/g, '_')}.json`,
            results.json,
            err => {
                if(err) throw err;
            }
        );
    });
} else {
    throw 'Please, pass a URL to Lighthouse';
}

