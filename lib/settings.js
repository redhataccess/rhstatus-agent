var resolveEnvVar = function(envVar) {
    if (envVar === void 0) {
        return void 0;
    }
    if (/^\$/i.test(envVar)) {
        return process.env[envVar.slice(1, envVar.length)];
    }
    return process.env[envVar];
};

var generateMongoUrl = function(db) {
    var openShiftMongoAddr = resolveEnvVar("OPENSHIFT_MONGODB_DB_URL");
    var dbName = (db || "rhstatus");
    if (openShiftMongoAddr)
        return openShiftMongoAddr + dbName;
    return "mongodb://localhost:27017/" + dbName;
};

var geo = 'NA';
module.exports = {
    // TODO, read from options
    geo: geo,
    generateMongoUrl: generateMongoUrl,
    resolveEnvVar: resolveEnvVar
};
