import fs from 'fs';
import http from 'http';

import schoolData from '../public/school-data.js';

const hostname = '127.0.0.1';
const port = 3008;

const server = http.createServer((request, response) => {
    const path = request.url.split('?')[0];
    let content = '';

    switch (path) {
    case '/':
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/html');
        content = fs.readFileSync('public/index.html', 'utf8');
        console.log('HTTP', response.statusCode, request.url);
        break;
    case '/index.js':
    case '/school-data.js':
    case '/address-data.js':
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/javascript');
        content = fs.readFileSync('public' + path, 'utf8');
        break;
    case '/schools.json':
        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json');
        content = JSON.stringify(schoolData);
        break;
    case '/main.css':
        response.statusCode = 200;
        response.setHeader('Content-Type', 'text/css');
        content = fs.readFileSync('public' + path, 'utf8');
        break;
    case '/img/404.jpg':
        response.statusCode = 200;
        response.setHeader('Content-Type', 'image/jpeg');
        content = fs.readFileSync('public' + path);
        break;
    case '/img/sfusd-16.png':
    case '/img/sfusd-32.png':
    case '/img/sfusd-57.png':
    case '/img/sfusd-60.png':
    case '/img/sfusd-70.png':
    case '/img/sfusd-72.png':
    case '/img/sfusd-76.png':
    case '/img/sfusd-96.png':
    case '/img/sfusd-120.png':
    case '/img/sfusd-128.png':
    case '/img/sfusd-152.png':
    case '/img/sfusd-167.png':
    case '/img/sfusd-180.png':
    case '/img/sfusd-192.png':
    case '/img/sfusd-400.png':
        response.statusCode = 200;
        response.setHeader('Content-Type', 'image/png');
        content = fs.readFileSync('public' + path);
        break;
    case '/img/favicon.ico':
        response.statusCode = 200;
        response.setHeader('Content-Type', 'image/x-icon');
        content = fs.readFileSync('public' + path);
        break;
    default:
        response.statusCode = 404;
        response.setHeader('Content-Type', 'text/html');
        content = fs.readFileSync('public/404.html', 'utf8');
        console.log('HTTP', response.statusCode, request.url);
        break;
    }

    response.setHeader('Content-Length', Buffer.byteLength(content));
    response.setHeader('Expires', new Date().toUTCString());
    response.end(content);
});

server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});
