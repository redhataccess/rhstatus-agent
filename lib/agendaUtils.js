var request         = require('request');
var Agenda          = require('agenda');
var MongoUtils      = require('./mongoUtils');
var logger          = require('winston');
logger.cli();
var memwatch        = require('memwatch-next');

var agenda = new Agenda({
    defaultConcurrency: 5,
    db: { address: 'localhost:27017/rhstatus'}
});

// Define a defaults method for always providing the User Agent
var rhAgentRequest = request.defaults({
    headers: {
        'User-Agent': 'rhstatus'
    }
});

var purge = function () {
    return new Promise(function (resolve, reject) {
        // Nuke all jobs to start with:
        agenda.purge(function(err, numRemoved) {
            if (err) return reject(err);
            return resolve(numRemoved);
        });
    });
};

var makeRequest = function (url, cb) {
    logger.info("Making a request to " + url);
    var document = MongoUtils.makeDoc(url);
    rhAgentRequest
        .get(document.url)
        .on('response', function(response) {
            document.msTaken = +(new Date()) - +document.date;
            document.statusCode = response.statusCode;
            MongoUtils.insertMetric(document).then(function(result) {
                logger.info("Successfully inserted %j", document);
            }).catch(function (err) {
                logger.error("Could not insert metric: %s", err.message);
            }).done(function () {
                document = null;
                cb();
            });
        })
        .on('error', function(err) {
            document.statusCode = 500;
            document.error = err.message;
            document.msTaken = +(new Date()) - +document.date;
            logger.error(err.message);
            MongoUtils.insertMetric(document).then(function(result) {
                logger.info("Successfully inserted %j", document);
            }).catch(function (err) {
                logger.error("Could not insert metric: %s", err.message);
            }).done(function () {
                document = null;
                cb();
            });
        });
};

var createGcAgenda = function () {
    //https://github.com/rschmukler/agenda/issues/129 - "Strange memory increasing"
    agenda.define('gc', function(job, done) {
        memwatch.gc();
        logger.info("[%s] Agenda - Forcing GC after  job '%s'... %dMB", new Date().toISOString(), job.attrs.name, ((process.memoryUsage().rss / 1024) / 1024).toFixed(1));
        done();
    });
    agenda.every('30 seconds', 'gc');
};

/**
 * Internal function to take a host frequency (in seconds) and make it human readable for Agenda
 * @param frequency
 * @returns {string}
 */
var makeDuration = function (frequency) {
    return frequency + " seconds";
};

/**
 *
 * Ex:
 * makeAgenda('https://redhat.com', '5 seconds');
 * makeAgenda('https://access.redhat.com', '5 seconds');
 * makeAgenda('https://mojo.redhat.com', '5 seconds');
 *
 * @param host Host object from Mongo containing at least hostname and duration fields
 */
var makeAgenda = function(host) {
    agenda.define(host.hostname, function(job, done) {
        makeRequest(host.hostname, done);
    });
    logger.info("Creating agenda with duration: %s and url: %s", makeDuration(host.frequency), host.hostname);
    agenda.every(makeDuration(host.frequency), host.hostname);
};

module.exports = {
    agenda: agenda,
    purge: purge,
    makeRequest: makeRequest,
    makeAgenda: makeAgenda,
    createGcAgenda: createGcAgenda
};
