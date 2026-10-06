const processedTransactions = new Map();

function saveResult(transactionId, result) {
    processedTransactions.set(transactionId, result);
}

function hasProcessed(transactionId) {
    return processedTransactions.has(transactionId);
}

function getResult(transactionId) {
    return processedTransactions.get(transactionId);
}

module.exports = {
    saveResult,
    hasProcessed,
    getResult
};