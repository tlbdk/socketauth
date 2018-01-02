// @ts-check
'use strict;'

var net = require('net')

// This server listens on a Unix socket at /var/run/mysocket
var unixServer = net.createServer(function(client) {
  // Do something with the client connection
})
unixServer.listen('/var/run/mysocket')

// This server listens on TCP/IP port 1234
var tcpServer = net.createServer(function(client) {
  // Do something with the client connection
})
tcpServer.listen(1234)
