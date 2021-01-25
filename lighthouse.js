const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const argv = require('yargs').argv; // for using url-path as an argument in terminal
const url = require('url');
//const config = require('./desktop-config.js');

const metricFilter = [
    'first-contentful-paint',
    'largest-contentful-paint',
    'speed-index',
    'estimated-input-latency',
    'total-blocking-time',
    'interactive',
    'cumulative-layout-shif'
];

const rootDirName = 'reports';
if(!fs.existsSync(rootDirName)) {        
    fs.mkdirSync(rootDirName);
}

const launchChromeAndRunLighthouse = async (url) => {
    const chrome = await chromeLauncher.launch({chromeFlags: ['--headless']});
    const options = {
      onlyCategories: ['performance'],
      port: chrome.port,     
    };
    // const result = await lighthouse(url, options, config);
    const result = await lighthouse(url, options);
    
    await chrome.kill();
  
    return {
      js: result.lhr,
      json: result.report
    };
};

const getContents = pathStr => {
    const output = fs.readFileSync(pathStr, 'utf8', (err, results) => results);
    return JSON.parse(output);
};

const compareReports = (from, to) => {  
    const calcPercentageDiff = (from, to) => {
      const per = ((to - from) / from) * 100;
      return Math.round(per * 100) / 100;
    };

    console.log('Performance score previous was ',Math.round(from.categories.performance.score * 100));
    console.log('Performance score current is ',Math.round(to.categories.performance.score * 100));
  
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

if (argv.url) {
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
        } else {
            console.log('Performance score current is ', Math.round(results.js.categories.performance.score * 100));
        }

        fs.writeFile(
            `${fullDirName}/${results.js.fetchTime.replace(/:/g, '_')}.json`,
            results.json,
            err => {
                if(err) throw err;
            }
        );
    });
} else {
    throw 'Please, pass a URL to Lighthouse';
}

