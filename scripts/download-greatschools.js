import https from 'https';
import http from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { URL } from 'url';
import { fileURLToPath } from 'url';
import { randomInt } from './random.js';
import schoolData from '../public/school-data.js';

// Configuration
const OUTPUT_DIR = './cache/greatschools';
const urls = [];

for (const school of schoolData) {
    const url = school.urls.greatschools;
    if (url === null) {
        console.log('No URL for:', school.name, school.types[0]);
        continue;
    }
    urls.push(url);
    //console.log(school.name, school.types[0], school.greatschools);
}

async function ensureOutputDir() {
    try {
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
    } catch (error) {
        console.error('Error creating output directory:', error);
    }
}

function getFilenameFromUrl(urlString) {
    const url = new URL(urlString);
    let filename = url.hostname + url.pathname;
    filename = filename.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    if (!filename.endsWith('.html')) {
        filename += '.html';
    }
    return filename;
}

function downloadHtml(url) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const protocol = urlObj.protocol === 'https:' ? https : http;

        const options = {
            timeout: randomInt(2000, 4000),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };

        console.log(`Downloading: ${url}`);

        const request = protocol.get(url, options, (response) => {
            let data = '';

            // Handle redirects
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                console.log(`Following redirect to: ${response.headers.location}`);
                downloadHtml(response.headers.location).then(resolve).catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}. Status: ${response.statusCode}`));
                return;
            }

            response.setEncoding('utf8');

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                resolve(data);
            });
        });

        request.on('error', (error) => {
            reject(error);
        });

        request.on('timeout', () => {
            request.destroy();
            reject(new Error(`Timeout downloading ${url}`));
        });
    });
}

// Alternative implementation using axios (requires: npm install axios)
/*
import axios from 'axios';

async function downloadHtmlWithAxios(url) {
    try {
        console.log(`Downloading: ${url}`);
        const response = await axios.get(url, {
            timeout: randomInt(2000, 4000),
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            maxRedirects: 5
        });
        return response.data;
    } catch (error) {
        throw new Error(`Failed to download ${url}: ${error.message}`);
    }
}
*/

// Save HTML to file
async function saveHtmlToFile(url, html) {
    const filename = getFilenameFromUrl(url);
    const filepath = path.join(OUTPUT_DIR, filename);

    try {
        await fs.writeFile(filepath, html, 'utf8');
        console.log(`Saved: ${filepath}`);
        return filepath;
    } catch (error) {
        console.error(`Error saving ${url}:`, error);
        throw error;
    }
}

// Process a single URL
async function processUrl(url) {
    try {
        const html = await downloadHtml(url);
        const filepath = await saveHtmlToFile(url, html);
        return { url, success: true, filepath };
    } catch (error) {
        console.error(`Failed to process ${url}:`, error.message);
        return { url, success: false, error: error.message };
    }
}

// Main function
async function main() {
    console.log('HTML Downloader Script');
    console.log('======================\n');

    await ensureOutputDir();

    const results = [];

    // Process URLs sequentially to avoid overwhelming the server
    for (const url of urls) {
        const result = await processUrl(url);
        results.push(result);

        // Add a small delay between requests to be polite
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n======================');
    console.log('Download Summary:');
    console.log(`Total URLs: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);

    // Show failed URLs if any
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
        console.log('\nFailed URLs:');
        failed.forEach(f => {
            console.log(`- ${f.url}: ${f.error}`);
        });
    }
}

// Check if this module is being run directly
const __filename = fileURLToPath(import.meta.url);
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

// Export functions for use in other modules
export { downloadHtml, saveHtmlToFile, processUrl, main };
