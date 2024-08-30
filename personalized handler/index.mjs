
import { google } from '/opt/node_modules/googleapis/build/src/index.js';
import { writeToGoogleSheets } from './sheets.js';

export const handler = async (event,context)=>{
    console.log("Trigger Happened");
    try{
        console.log("starting the fn.");
        console.log("current full event");
        console.log(event);
        const orderData=event.body;
        
        await writeToGoogleSheets(orderData,event);
            
        // Return a success response with status code 200
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'written' }),
            headers: {
                'Content-Type': 'application/json',
            },
        };
    }catch(ex){
        console.log(ex);
        // Return an error response with status code 500
        //changed or the webbhook will be deleted by shopify
        return {
            statusCode: 200,
            body: JSON.stringify({ ex }),
            headers: {
                'Content-Type': 'application/json',
            },
        };
    }
    
}