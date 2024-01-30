require('dotenv').config();
const axios       = require('axios');
const { Storage } = require('@google-cloud/storage');

exports.backup_gcf_call = async (req, res) => {
    let logData = ''; // Variable to store log data

    function log(message) {
        console.log(message);
        logData += message + '\n'; // Add log message to logData
    }

    try {
        log('Received backup request');

        // Receive parameters from Bubble
        const { from, until, DataType } = req.body;
        log(`Received parameters - Start date: ${from}, End date: ${until}, Data type: ${DataType}`);

        // Check if 'from' and 'until' are valid dates
        if (isNaN(Date.parse(from)) || isNaN(Date.parse(until))) {
            log('Invalid date format');
            res.status(400).send('Invalid date format for "from" or "until" parameter');
            return;
        }
        log('Date parameters are valid');

        // Bubble API endpoint and parameters
        const bubbleApiUrl = process.env.BUBBLE_API_URL + 'save_log_data_api';
        const params       = { from, until, DataType };
        const headers      = {
            'Authorization': `Bearer ${process.env.BEARER_TOKEN}`,
            'Content-Type' : 'application/json'
        };
        log(`Calling Bubble API: ${bubbleApiUrl} Parameters:`, params);

        // Call Bubble API
        const response     = await axios.post(bubbleApiUrl, params, { headers });
        const responseData = response.data;
        log('Received data from Bubble API:', responseData);

        // Upload data to GCS
        const storage    = new Storage();
        const bucketName = process.env.BUCKET_NAME; // Replace with your bucket name
        const myBucket   = storage.bucket(bucketName);
        const file       = myBucket.file(`${DataType}_${from.replace(/\//g, '')}_${until.replace(/\//g, '')}.csv`);

        try {
            await file.save(responseData.response.data);
            log(`Data uploaded to GCS: gs://${bucketName}/${file.name}`);
        } catch (err) {
            log('Error occurred while uploading to GCS:', err);
            throw err;
        }

        // Bubble API endpoint and parameters
        const bubbleDeleteUrl = process.env.BUBBLE_API_URL + 'delete_log_data_api';
        log(`Calling Bubble API: ${bubbleDeleteUrl} Parameters:`, params);

        // Call Bubble API
        const deleteResponse = await axios.post(bubbleDeleteUrl, params, { headers });
        const count          = deleteResponse.data;
        log('Received data from Bubble delete API:', count);

        // Upload log data to GCS
        const logFile = myBucket.file(`Proccess_Log_${from.replace(/\//g, '')}_${until.replace(/\//g, '')}.txt`);

        try {
            await logFile.save(logData);
            log(`Log data uploaded to GCS: gs://${bucketName}/${logFile.name}`);
        } catch (err) {
            log('Error occurred while uploading to GCS:', err.message);
            throw err;
        }

        // Return response
        res.status(200).send(responseData);
        log('All processes have finished successfully.');
    } catch (error) {
        log('An error occurred:', error.message);
        res.status(400).send(error.message);
    }
}
