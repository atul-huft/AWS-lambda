
// import { requeue } from './mqsender.js';
// import { getColumnName } from './columnName.js';
import { google } from 'googleapis';
import axios from 'axios';
import AWS from 'aws-sdk';
import csv from 'csv-parser';
import { MongoClient } from 'mongodb';

import mongoose from 'mongoose';
let currDate;
let msg;
let orderedDate;
let orderId;
let parsedJson;
const sheetName="dev-demo-2";
const auth = new google.auth.GoogleAuth({
    keyFile: "secret.json",
    scopes: "https://www.googleapis.com/auth/spreadsheets"
});

AWS.config.update({
    accessKeyId: 'AKIA5AEP',
    secretAccessKey: 'CiIUeBK2fBecfT+J8wlR'
  });

const authClientObject = await auth.getClient();
const spreadsheetId = "1aMTWevZ3ZD5do";
const googleSheetsInstance = google.sheets({
    version: "v4",
    auth: authClientObject,
});
        
const s3 = new AWS.S3();

//connecting to db

// Connection URI, replace with your actual MongoDB connection string

async function connectToDatabase() {
    const uri = "mongodb://mobile_dev:";
    const client = new MongoClient(uri);
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        return client.db();
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

//Function: Fetch product images
const getProductImagesByProductId = async (productId) => {
    try {
        console.log("inside getproduct image by product id");
        const url = 'https://headsupfortails.myshopify.com/admin/api/2023-07' + `/products/${productId}/images.json`;
        const config = {
            method: 'get',
            url,
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': ''
            }
        };
        const result = await axios(config);
        return result.data.images.map(image => image.src);
    } catch (ex) {
        console.log('Error fetching product images:', ex);
        // return [];  
    }
};

function getColumnName(index) {
    let columnName = '';
    while (index > 0) {
        const remainder = (index - 1) % 26;
        columnName = String.fromCharCode(65 + remainder) + columnName;
        index = Math.floor((index - 1) / 26);
    }
    return columnName;
}


const readData = async (params) => {
    try {
        const { Body } = await s3.getObject(params).promise();
        return Body.toString('utf-8');
    } catch (error) {
        console.error('Error reading data from S3:', error);
        throw error;
    }
};

async function uploadSyncStatus(parsedJson){
    const db=await connectToDatabase();
    const collection=db.collection('shopifysyncstatus');

    const shopId=parsedJson.id;
    const Shopifytimestamp=parsedJson.created_at;

    console.log(shopId);
    console.log(Shopifytimestamp);  

    console.log("created a schema");
        
    const newSync={
        ShopifyID: shopId,
        ShopifyTimestamp: Shopifytimestamp,
        Status: false,
        syncTime: 0
    };
        
    const res=await collection.insertOne(newSync);
    console.log(res);
}


async function calculateTat(data, product){
    try{

        const s3Bucket = 'personalizedroducts-huft';
        
        const paramsBuffer={
            Bucket : s3Bucket,
            Key : 'dasv'
        };
         const bufferData=await readData(paramsBuffer);
         
        const linesBuffer = bufferData.split('\n');
        const bufferMap = new Map();
        
        for (const line of linesBuffer) {
            // Split the line into fields using comma as the delimiter
            const fields = line.split(','); 

            // Extract relevant information from the fields

            const serialNumber = fields[0];
            const date = fields[1];
            const day = fields[2];

            // Create an object representing the product
            const buffer = {
                serialNumber,
                date,
                day
            };

            // Store the product in the map using the serial number as the key
            bufferMap.set(serialNumber, buffer);
        }
        
        console.log("Read Buffer Data");
        
        // let currDate = parsedJson.created_at;
        console.log(currDate);
        const date = new Date(currDate);
        
        // Get individual date components
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        // Create the formatted date string
        const formattedDate = `${year}-${month}-${day}`;
        orderedDate=formattedDate;
        console.log("date of order placed",orderedDate);
        
        let nearestDate;
        let minDifference = Infinity;
        let s;

        // Iterate over the entries of the bufferMap
        for (const [serialNumber, buffer] of bufferMap.entries()) {
            // Extract the date string from the current buffer
             const currentDate = buffer.date;
    
            // Convert the date strings to Date objects for comparison
            const currentDateObj = new Date(currentDate);
            const formattedDateObj = new Date(formattedDate);
    
            // Calculate the absolute difference in milliseconds between the current date and the formatted date
            const difference = Math.abs(currentDateObj - formattedDateObj);
    
            // Check if the current difference is smaller than the current minimum difference
            if (difference < minDifference) {
                // If so, update the nearest date and its difference
                nearestDate = currentDate;
                minDifference = difference;
                s=serialNumber;
            }
        }
        
        const dateID=bufferMap.get(s);
    
        console.log(dateID.date);
        console.log(dateID.serialNumber,"serial number of the date");
        
        console.log("finidng the buffer time of the sku");
        console.log(data.sku);
        let bufferTime=product.buffer;
    
        const t=parseInt(s)+ parseInt(bufferTime);
        const TAT=bufferMap.get(t.toString());
        console.log("TAT",TAT);
        const tatDate=TAT.date;
        console.log("successfully found the date",tatDate);
        return tatDate;
    } catch (error) {
        console.log("error getting the date", error);
    }
}



export const writeToGoogleSheets = async (msg,event) => {
    try {
        console.log("inside the write google sheet function");
        
        console.log(msg);
        // const parsedJson=msg;
        parsedJson=JSON.parse(msg);
        
        
        currDate = parsedJson.created_at;


        orderId=parsedJson.name;
        
        //      /*-----change-----*/
        const lineItems = parsedJson.line_items;

        console.log("Connected with sheet=",sheetName);
        
        // Connecting with S3
        const s3Bucket = 'personalizedroducts-huft';
        const s3Key = 'updsv';
        const paramsPersonalised={
            Bucket : s3Bucket,
            Key : s3Key
        };
        
        const personalizedCsv=await readData(paramsPersonalised);
        const lines = personalizedCsv.split('\n');
        const personalizedProductsMap = new Map();
        
        for (const line of lines) {
            // Split the line into fields using comma as the delimiter
            const fields = line.split(','); 

            // Extract relevant information from the fields
            // const productId = fields[0];
            const sku = fields[0];
            const productName = fields[1];
            const subcategory = fields[2];
            const size = fields[3];
            const buffer = fields[4];

            // Create an object representing the product
            const product = {
              sku,
              productName,
              subcategory,
              size,
              buffer
            };

            // Store the product in the map using the product ID as the key
            personalizedProductsMap.set(sku, product);
        }
        await findSku(lineItems, personalizedProductsMap);
        // const findSku = async (orderData, personalizedProductsMap, bufferMap)
        return ;
        
    } catch (error) {
        console.log("Error updating Google Sheet:", error.message);
        return {
            statusCode: 200, 
            body: JSON.stringify({ error: error.message, message: "Processed with errors" })
        };
    }
};

let allProperties;
const findSku = async (orderData, personalizedProductsMap) => {

    // let personalizedProducts=[];
    allProperties = new Set();
    try {
         // Check for existing entries in the sheet
        const existingOrders = await googleSheetsInstance.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A:A` // Assuming Order ID is in column A
        });

        const existingOrderIds = existingOrders.data.values ? existingOrders.data.values.flat() : [];


        for (let i = 0; i < orderData.length; i++) {
            let personalizedProducts=[];
            console.log("product number => ",i);
            let sku = orderData[i].sku;
            
            const product = personalizedProductsMap.get(sku);

            if(product){
                console.log("======================== p e r s o n a l i s e d ==================================");
                personalizedProducts.push(orderData[i]);
                console.log("======================== p e r s o n a l i s e d ==================================");
            } else {
                console.log("not personalised");
                console.log(orderData[i]);
                continue;
            }
            console.log("personalised products ", personalizedProducts);
            if (personalizedProducts) {
                personalizedProducts.forEach(item => {
                    if (item.properties && item.properties.length > 0) {
                        item.properties.forEach(property => {
                            allProperties.add(property.name);
                            console.log(property.name);
                        });
                    }
                });
            }
            
               
            if (existingOrderIds.includes(orderId)) {
              console.log("================================================");
              console.log(`Order ID ${orderId} already exists in the sheet. Skipping...`);
              console.log("-----------------------------------");
              return;
            }
            
            console.log("all properties",allProperties);
            console.log("================================================");

            const TatDate=await calculateTat(orderData[i], product);

            console.log("TAT Date",TatDate);

            
            // Get existing headers from the sheet
            const existingHeaders = await googleSheetsInstance.spreadsheets.values.get({
                spreadsheetId,
                range: `${sheetName}!1:1`
            });

            console.log("Existing headers ",existingHeaders.data.values);

            const sheetHeaders = existingHeaders.data.values ? existingHeaders.data.values[0] : [];
            console.log("sheet headers :",sheetHeaders);

            
            // Define excluded headers
            const excludedHeaders = ["_boldOptionLocalStorageId", "_Returable\/NonReturnable"];

            // Filter out properties that are already in the sheet and excluded headers
            const newProperties = Array.from(allProperties).filter(newHeader => !sheetHeaders.includes(newHeader) && !excludedHeaders.includes(newHeader));
            console.log("New properties to add:", newProperties);
          

            // Combine default columns with existcing headers and new properties
          const headers = [
              'Order ID', 'Product Name','Sub-Category', 'SKU','Price', 'Quantity','Ordered Date', 'TAT', 'Size', 'Image',
              ...sheetHeaders.filter(header => !['Order ID', 'Product Name','Sub-Category', 'SKU','Price', 'Quantity','Ordered Date', 'TAT', 'Size', 'Image', ...excludedHeaders].includes(header)),
              ...newProperties
          ];

            console.log("headers", headers);
            console.log("filling up the google sheets with headers");
            console.log("header length", headers.length);
            const lastColumn = getColumnName(headers.length);
            console.log("last column for filing in the googles sheets",lastColumn);
           

            // const lastColumn = headers.length;
            const headerRange = `A1:${lastColumn}1`;
            console.log("header range",headerRange);
            // If headers do not exist or if they are different, update them in the sheet
            if (!arrayEquals(headers, sheetHeaders)) {
              console.log("Updating headers to:", headers);
                await googleSheetsInstance.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!${headerRange}`,
                    valueInputOption: "USER_ENTERED",
                    resource: { values: [headers] },
                });
            }

              // . //   Create a dynamic 2D array for properties
              
            const size=product.size;
            let subcategory=product.subcategory;
            let Name=orderData[i].name;
            const propertiesArray = [];
            console.log("before fetching image");
            // const orderId=orderData.name;
            console.log("number of items in the personalizedProducts",personalizedProducts.length);
            // Iterate through personalized products and populate propertiesArray
            if (personalizedProducts) {
                for (const item of personalizedProducts) {
                    const row = [];
                    row.push(orderId,Name, subcategory, item.sku, item.price, item.quantity, orderedDate, TatDate, size);     
                    // Fetch product images
                    const imageUrls = await getProductImagesByProductId(item.product_id);
                    console.log("fetching the image url using productid=",item.product_id);
                    const firstImageUrl = imageUrls.length > 0 ? imageUrls[0] : '';
                    const imageFormula = `=IMAGE("${firstImageUrl}", 2)`; // Assuming the image is in the second row
                    row.push(imageFormula);
                    console.log("after fetching image");

                    // Iterate through existing headers and populate propertiesArray
                    sheetHeaders.slice(10).forEach(header => {
                        const property = item.properties.find(prop => prop.name === header);
                        console.log("Existing properties - ",property);
                        const columnIndex = headers.indexOf(header);
                        console.log("Existing columnIndex - ",columnIndex);
                        row[columnIndex] = property ? property.value : '';
                    });

                    //adding dynamic column for new properties
                    newProperties.forEach(newHeader => {
                        const property = item.properties.find(prop => prop.name === newHeader);
                        console.log("New properties - ",property);
                        const columnIndex = headers.indexOf(newHeader);
                        console.log("New columnIndex - ",columnIndex);
                        if (columnIndex !== -1) {
                            row[columnIndex] = property ? property.value : '';
                        } else{
                            console.log('ELSE CASE NEW');
                        }
                    });
                    propertiesArray.push(row);
                    console.log(row);
                }
            }

            
            console.log("before writing it to sheets");
            console.log(propertiesArray);
            await googleSheetsInstance.spreadsheets.values.append({
                spreadsheetId,
                range: sheetName, // Assuming data starts at the first row
                valueInputOption: "USER_ENTERED",
                insertDataOption: "INSERT_ROWS",
                resource: { values: propertiesArray },
            });
            console.log("Data has been successfully written to the Google Sheet.");

            // return ;
        }
        console.log("OrderData processed");
        
    } catch (error) {
        console.log("Error finding SKU", error);
        return {
            statusCode: 200,
            body: JSON.stringify({ message: "catch : findSKU" })
        };

    }
};

// Function to check if two arrays are equal

function arrayEquals(arr1, arr2) {
  return JSON.stringify(arr1) === JSON.stringify(arr2);
}