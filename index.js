var settings        = require('./lib/settings');
var Promise     = require("bluebird");
Promise.longStackTraces();
var MongoDB     = Promise.promisifyAll(require("mongodb"));
var MongoClient = Promise.promisifyAll(MongoDB.MongoClient);
var ObjectID    = require('mongodb').ObjectID;
var MongoUtils  = require('./lib/mongoUtils');

var _               = require('lodash');
var AgendaUtils     = require('./lib/agendaUtils');
var logger          = require('winston');
logger.cli();


function graceful() {
    AgendaUtils.agenda.stop(function() {
        logger.debug("Stopping agenda.");
        process.exit(0);
    });
}
process.on('SIGTERM', graceful);
process.on('SIGINT' , graceful);


// Nuke all jobs to start with:
AgendaUtils.purge()
    .then(function(numRemoved) {
        logger.info("Purged %s job(s) on startup", numRemoved);
        return MongoUtils.makeMongoConnection();
    }).then(function (db) {
        // This could be async series, if it grows I'll do that, for now 1 nest is tolerable
        MongoUtils.readHosts()
            .then(function(hosts) {
                logger.info("Read %s hosts to create agendas from.", hosts.length);
                _.each(hosts, function(h) {
                    // TODO, do error checking to ensure the hostname is FQ
                    AgendaUtils.makeAgenda(h)
                });

                // Create a GC job as there is a memory leak in Agenda, but a regular GC takes care of it no problem
                AgendaUtils.createGcAgenda();

                // TODO - define another job which will re-fetch from mongo and add new jobs or re-init changed ones

                logger.info("Starting the Agenda process.");
                AgendaUtils.agenda.start();
            })
            .catch(function(err) {
                logger.error(err)
            });


    }).catch(function(err) {
        logger.info("Could not purge the agenda on startup: " + err.message);
    });
