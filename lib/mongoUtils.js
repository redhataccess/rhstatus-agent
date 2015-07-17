var settings    = require("./settings");
var Promise     = require("bluebird");
Promise.longStackTraces();
//var MongoClient = require('mongodb').MongoClient;
var MongoDB     = Promise.promisifyAll(require("mongodb"));
var MongoClient = Promise.promisifyAll(MongoDB.MongoClient);
var logger      = require('winston');
logger.cli();

var dbName = "rhstatus";
var collectionNameHosts = "hosts";
var collectionNameMetrics = "metrics";
var db = null;

var makeDoc = function (url) {
    return {
        date: new Date(),
        statusCode: null,
        msTaken: null,
        geo: settings.geo,
        url: url,
        error: null
    };
};

var printDoc = function(doc) {
    //logger.info(JSON.stringify(doc, null, ' '));
    logger.info(doc);
};

//https://mongodb.github.io/node-mongodb-native/driver-articles/mongoclient.html
/**
 * Convenience method for ensuring all client connection autoReconnect and any other options we want as default.  Note
 * that since the MongoClient is pooled by default, only need to open one connection here and reuse the db.
 * @param mongoUrl Optional mongo:// url or default is generated from configuration
 * @returns {*}
 */
var makeMongoConnection = function (mongoUrl) {
    return new Promise(function (resolve, reject) {
        MongoClient.connectAsync(mongoUrl || settings.generateMongoUrl(dbName), {
            server: {
                auto_reconnect: true
            }
        }).then(function (_db) {
            db = _db;
            resolve(db);
        }).catch(function (err) {
            reject(err);
        });
    });
};

/**
 * Takes a request doc and persists it to the metrics collection, see @makeDoc for the schema
 * @param doc
 * @returns {bluebird|exports|module.exports}
 */
var insertMetric = function(doc) {
    return new Promise(function (resolve, reject) {
        return db.collection(collectionNameMetrics).insertOneAsync(doc)
            .then(function (result) { resolve(result); })
            .catch(function (err) { reject(err); });
    });
};

var readHosts = function() {
    return new Promise(function (resolve, reject) {
        return db.collection(collectionNameHosts).find({}).toArrayAsync()
            .then(function(hosts) { resolve(hosts); })
            .catch(function(err) { reject(err); });
    });
};

module.exports = {
    printDoc: printDoc,
    makeDoc: makeDoc,
    readHosts: readHosts,
    insertMetric: insertMetric,
    makeMongoConnection: makeMongoConnection
};
