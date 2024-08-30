// import { requeue } from './mqsender.js';
// import { getColumnName } from './columnName.js';
import { google } from 'googleapis';
import axios from 'axios';
import AWS from 'aws-sdk';
import csv from 'csv-parser';
import { MongoClient } from 'mongodb';

import mongoose from 'mongoose';

const s3 = new AWS.S3();
//connecting to db

// Connection URI, replace with your actual MongoDB connection string

async function connectToDatabase() {
    const uri = "mongodb://mobile_dev:Sar1:27017/admin";
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
        const url = process.env.SHOPIFY_URL + `/products/${productId}/images.json`;
        const config = {
            method: 'get',
            url,
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
            }
        };
        const result = await axios(config);
        return result.data.images.map(image => image.src);
    } catch (ex) {
        console.error('Error fetching product images:', ex.message);
        return [];  
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

//Function: READ data
const readData = async (params) => {
    try {
        const { Body } = await s3.getObject(params).promise();
        return Body.toString('utf-8');
    } catch (error) {
        console.error('Error reading data from S3:', error);
        throw error;
    }
};

// Main
export const writeToGoogleSheets = async (msg,event) => {
    try {
        console.log("inside the write google sheet function");
        const db=await connectToDatabase();
        const collection=db.collection('shopifysyncstatus');
        console.log(msg);
        const parsedJson=JSON.parse(msg);
        console.log(msg.id, "message id");
        // console.log(Shopifytimestamp)
        const shopId=parsedJson.id;
        const Shopifytimestamp=parsedJson.created_at;
        let status=false;
        let syncTime;
        console.log(shopId);
        console.log(Shopifytimestamp)    

        console.log("created a schema");
        
        const newSync={
            ShopifyID: shopId,
            ShopifyTimestamp: Shopifytimestamp,
            Status: false,
            syncTime: 0
        };
        const res=await collection.insertOne(newSync);
        console.log(res);

        const orderId= parsedJson.id;
        const lineItems = parsedJson.line_items;

        
        // Connecting with Google Sheets
        const auth = new google.auth.GoogleAuth({
            keyFile: "secret.json",
            scopes: "https://www.googleapis.com/auth/spreadsheets"
        });
        const authClientObject = await auth.getClient();
        const spreadsheetId = "1aMTWZ3ZD5do";
        const googleSheetsInstance = google.sheets({
            version: "v4",
            auth: authClientObject,
        });
        
        // console.log("-----");
        
        const sheetName = "dev";
        console.log("Connected with sheet=",sheetName);
        
        // Connecting with S3
        const s3Bucket = 'personalizedroducts-huft';
        const s3Key = 'adsv';
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
            const productId = fields[0];
            const productName = fields[1];
            const sku = fields[2];
            const size = fields[3];
            const status = fields[4];
            const comment=fields[5];
            const buffer = fields[6];

            // Create an object representing the product
            const product = {
                productId,
                productName,
                sku,
                size,
                status,
                comment,
                buffer
            };

            // Store the product in the map using the product ID as the key
            personalizedProductsMap.set(sku, product);
        }
        
        // console.log("read file 1");
        const paramsBuffer={
            Bucket : s3Bucket,
            Key : 'reports.csv'
        };
        const bufferData=await readData(paramsBuffer);
         
        const linesBuffer = bufferData.split('\n');
        const bufferMap = new Map();
        
        for (const line of linesBuffer) {
            // Split the line into fields using comma as the delimiter
            const fields = line.split(','); 

            // Extract relevant information from the fields
            const id = fields[0];
            const serialNumber = fields[1];
            const date = fields[2];
            const day = fields[3];

            // Create an object representing the product
            const buffer = {
                id,
                serialNumber,
                date,
                day
            };

            // Store the product in the map using the serial number as the key
            bufferMap.set(serialNumber, buffer);
        
            
        }
        console.log("Read Buffer Data");
        
        let personalizedProducts=[];
        const allProperties = new Set();
        
        
        // Finding personalized products based on the SKU
        const findSku = async (orderData) => {
            // const orderId=orderData.id;
            // console.log("inside find sku function");
            // console.log("the current order data");
            // console.log(orderData);
            
            // console.log("the line items are as follows");
            // console.log("Number of items in order are => ", orderData.length);
            try {
                for (let i = 0; i < orderData.length; i++) {
                    
                    console.log("product number => ",i);
                    let sku = orderData[i].sku;
                    console.log("inside try block");
                    console.log("SKU-",sku);
                    
                    const product = personalizedProductsMap.get(sku);

                    if(product){
                        console.log("========================personalised==================================");
                        console.log("personalised");
                        console.log(orderData[i]);
                        console.log("game");
                        // personalizedProducts.push(orderData[i].line_items);
                        personalizedProducts.push(orderData[i]);
                    } else {
                        console.log("not personalised");
                        console.log(orderData[i]);
                        console.log("next iteration");
                        continue;
                    }
                    
                    // Determine the unique set of properties from all personalized products
                    if (personalizedProducts) {
                        personalizedProducts.forEach(item => {
                            
                            //this can cause bugs
                            //item.properties
                            if (item.properties && item.properties.length > 0) {
                                item.properties.forEach(property => {
                                    allProperties.add(property.name);
                                });
                            }
                        });
                    }
                    console.log("================================================");
                    // TAT CALCULATION based on buffer
                    let currDate = parsedJson.created_at;
                    console.log(currDate);
                    const date = new Date(currDate);
                    // Get individual date components
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    // Create the formatted date string
                    const formattedDate = `${year}-${month}-${day}`;
                    const orderedDate=formattedDate;
                    console.log("-----");
                    console.log("date of order placed",orderedDate);
                    
                    //date has been calculated 
                    //now fetch the buffer time of the produt
                    
                    //Fetching the date of TAT
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
                    
                    // console.log("Date ID ",dateID);
                    console.log(dateID.date);
                    console.log(dateID.serialNumber,"serial number of the date");
                    
                    //finding the buffer of the product
                    
                    console.log("finidng the buffer time of the sku");
                    console.log(orderData[i].sku);
                    let bufferTime=product.buffer;
    
                    const t=parseInt(s)+ parseInt(bufferTime);
                    const TAT=bufferMap.get(t.toString());
                    console.log("TAT",TAT);
                    const tatDate=TAT.date;
                    console.log("successfully found the date",tatDate);
                    
                    // Get existing headers from the sheet
                    const existingHeaders = await googleSheetsInstance.spreadsheets.values.get({
                        spreadsheetId,
                        range: `${sheetName}!1:1`
                    });
                    const sheetHeaders = existingHeaders.data.values ? existingHeaders.data.values[0] : [];

                    // Define excluded headers
                    const excludedHeaders = ["_boldOptionLocalStorageId", "_Returable/NonReturnable"];

                    // Filter out properties that are already in the sheet and excluded headers
                    const newProperties = Array.from(allProperties).filter(newHeader => !sheetHeaders.includes(newHeader) && !excludedHeaders.includes(newHeader));

                    // Combine default columns with existing headers and new properties
                    const headers = [
                        'Order Id', 'ProductName','Product Id', 'Price', 'Quantity', 'SKU','Order Date', 'TAT', 'Size', 'Ref Image',
                        ...sheetHeaders.filter(header => !['order_id', 'name','product_id', 'price', 'quantity', 'sku','orderedDate', 'TAT', 'size', 'image', ...excludedHeaders].includes(header)),
                        ...newProperties
                    ];
                    console.log("filling up the google sheets with headers")
                    const lastColumn = getColumnName(headers.length);
                    // const lastColumn = headers.length;
                    const headerRange = `A1:${lastColumn}1`;

                    // If headers do not exist or if they are different, update them in the sheet
                    if (!arrayEquals(headers, sheetHeaders)) {
                        await googleSheetsInstance.spreadsheets.values.update({
                            spreadsheetId,
                            range: `${sheetName}!${headerRange}`,
                            valueInputOption: "USER_ENTERED",
                            resource: { values: [headers] },
                        });
                    }
 
                    // Create a dynamic 2D array for properties
                    const size=product.size;
                    const propertiesArray = [];
                    console.log("before fetching image"); 
                    // const orderId=orderData.name;
                    console.log("number of items in the personalizedProducts",personalizedProducts.length)
                    // Iterate through personalized products and populate propertiesArray
                    if (personalizedProducts) {
                        for (const item of personalizedProducts) {
                            const row = [];
                            row.push(orderId, item.name, item.product_id, item.price, item.quantity, item.sku, orderedDate, tatDate, size);
                            // Fetch product images
                            const imageUrls = await getProductImagesByProductId(item.product_id);
                            console.log("fetching the image url using productid=",item.product_id)
                            const firstImageUrl = imageUrls.length > 0 ? imageUrls[0] : '';
                            const imageFormula = `=IMAGE("${firstImageUrl}", 2)`; // Assuming the image is in the second row
                            row.push(imageFormula);
                            console.log("after fetching image")

                            // Iterate through existing headers and populate propertiesArray
                            sheetHeaders.slice(10).forEach(header => {
                                const property = item.properties.find(prop => prop.name === header);
                                const columnIndex = headers.indexOf(header);
                                row[columnIndex] = property ? property.value : '';
                            });
                            ////
                            
                            //// RECEENT Chages
                            
                            /////
                            //adding dynamic column for new properties
                            newProperties.forEach(newHeader => {
                                const property = item.properties.find(prop => prop.name === newHeader);
                                const columnIndex = headers.indexOf(newHeader);
                                if (columnIndex !== -1) {
                                    row[columnIndex] = property ? property.value : '';
                                }
                            });
                            propertiesArray.push(row);
                            console.log(row);
                        }
                    }
                    
                    console.log("before writing it to sheets");
                    await googleSheetsInstance.spreadsheets.values.append({
                        spreadsheetId,
                        range: sheetName, // Assuming data starts at the first row
                        valueInputOption: "USER_ENTERED",
                        insertDataOption: "INSERT_ROWS",
                        resource: { values: propertiesArray },
                    });
                    console.log("Data has been successfully written to the Google Sheet.");
                    
                    //change 2
                    
                    // return ;
                }
                console.log("OrderData processed");
                
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: "Done" })
                };
                
            } catch (error) {
                console.log("Error finding SKU", error.message);
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: "catch : findSKU" })
                };
                
                // throw `find sku error ${error}`;
            }
        }
            await findSku(lineItems);
            return ;
        } catch (error) {
        console.log("Error updating Google Sheet:", error.message);
        return {
            statusCode: 200, 
            body: JSON.stringify({ error: error.message, message: "Processed with errors" })
        };
    }
};

// Function to check if two arrays are equal
function arrayEquals(arr1, arr2) {
    return JSON.stringify(arr1) === JSON.stringify(arr2);
}

