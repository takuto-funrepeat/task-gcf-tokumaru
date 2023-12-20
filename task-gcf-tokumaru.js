require('dotenv').config();
const axios = require('axios');
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
        const { from, until, datatype } = req.body;
        log(`Received parameters - Start date: ${from}, End date: ${until}, Data type: ${datatype}`);

        // Check if 'from' and 'until' are valid dates
        if (isNaN(Date.parse(from)) || isNaN(Date.parse(until))) {
            log('Invalid date format');
            res.status(400).send('Invalid date format for "from" or "until" parameter');
            return;
        }
        log('Date parameters are valid');

        // Bubble API endpoint and parameters
        const bubbleApiUrl = process.env.BUBBLE_API_URL;
        const params = { from, until, datatype };
        const headers = {
            'Authorization': `Bearer ${process.env.BEARER_TOKEN}`,
            'Content-Type': 'application/json'
        };
        log(`Calling Bubble API: ${bubbleApiUrl} Parameters:`, params);

        // Call Bubble API
        const response = await axios.post(bubbleApiUrl, params, { headers });
        const responseData = response.data;
        log('Received data from Bubble API:', responseData);

        // Upload data to GCS
        const storage = new Storage();
        const bucketName = process.env.BUCKET_NAME; // Replace with your bucket name
        const myBucket = storage.bucket(bucketName);
        const file = myBucket.file(`${datatype}_${from.replace(/\//g, '')}_${until.replace(/\//g, '')}.csv`);

        file.save(responseData.response.data, function(err) {
            if (!err) {
                log(`Data uploaded to GCS: gs://${bucketName}/${file.name}`);
            } else {
                log('Error occurred while uploading to GCS:', err);
            }
        });

        // Bubble API endpoint and parameters
        const bubbledeleteurl = process.env.BUBBLE_DELETE_URL;
        log(`Calling Bubble API: ${bubbledeleteurl} Parameters:`, params);

        // Call Bubble API
        const deleteResponse = await axios.post(bubbledeleteurl, params, { headers });
        const count = deleteResponse.data;
        log('Received data from Bubble delete API:', count);

        // Upload log data to GCS
        const logFile = myBucket.file(`log_${from.replace(/\//g, '')}_${until.replace(/\//g, '')}.txt`);

        logFile.save(logData, function(err) {
            if (!err) {
                log(`Log data uploaded to GCS: gs://${bucketName}/${logFile.name}`);
            } else {
                log('Error occurred while uploading to GCS:', err);
            }
        });

        // Return response
        res.status(200).send(responseData);
        log('All processes have finished successfully.');
    } catch (error) {
        log('An error occurred:', error.message);
        res.status(500).send(error.message);
    }
};