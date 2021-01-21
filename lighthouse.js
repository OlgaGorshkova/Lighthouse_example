const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const argv = require('yargs').argv; // for using url-path as an argument in terminal
const url = require('url');
const fs = require('fs');

const launchChromeAndRunLighthouse = url => {
    return chromeLauncher.launch().then(chrome => {
        const  opts = {
            port: chrome.port
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

const rootDirName = 'reports';
if(!fs.existsSync(rootDirName)) {        
    fs.mkdirSync(rootDirName);
}

if(argv.url) {
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

