import puppeteer from 'puppeteer';
import * as fs from 'node:fs';

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 600, height: 400, deviceScaleFactor: 1 });

const standalone = fs.readFileSync('/workspace/dist/lightweight-charts.standalone.development.js', 'utf-8');
const caseContent = fs.readFileSync('/workspace/tests/e2e/graphics/test-cases/series/last-value-time-label.js', 'utf-8');

const html = `<!DOCTYPE html><html><head><style>html,body{padding:0;margin:0}#container{width:600px;height:400px;position:relative}</style></head><body><div id="container"></div><script>${standalone}</script><script>${caseContent}</script></body></html>`;
fs.mkdirSync('/tmp/shot', { recursive: true });
fs.writeFileSync('/tmp/shot/page.html', html);
await page.goto('file:///tmp/shot/page.html');
await new Promise(r => setTimeout(r, 1000));
await page.screenshot({ path: '/tmp/shot/label.png' });
await browser.close();
console.log('done');
