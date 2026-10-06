function log(message, data ={}) {
    console.log(JSON.stringify({time: new Date().toISOString(), message, ...data}));
}

module.exports = {
    log
};
