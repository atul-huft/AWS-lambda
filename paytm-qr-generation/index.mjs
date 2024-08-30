
import bodyParser from 'body-parser';
import AWS from 'aws-sdk';
import fs from 'fs';
import { PaytmChecksum } from './PaytmChecksum.js';
import nodemailer from 'nodemailer';
import qr from 'qrcode';
import axios from 'axios';
import qri from 'qr-image';

// Configure AWS
AWS.config.update({
  accessKeyId: 'devops',
  secretAccessKey: ''
});


export const handler = async (event, context) => {
  
  console.log(event);
  console.log("parsed json");
  const pjson=JSON.parse(event.body);
  
  console.log(pjson);
  
  const { orderId, amount , email } = pjson;

  
  
  // console.log(pjson.body.orderId)
  
  // console.log(pjson.orderId)
  console.log(amount)
  console.log(email)
  console.log(orderId)
  
  const url=await createQRCode(orderId,amount,email);
  
  // await sendNotification(url,orderId);
  
  return {
      statusCode: 200, 
        body: JSON.stringify({ url })
      };
};

async function createQRCode(orderId, amount, email) {
  const paytmParams = {
      mid: "test5P07128923987041",
      orderId: orderId,
      amount: amount,
      businessType: "UPI_QR_CODE",
      posId: "S12_123"
    };
  
    try {
      const checksum = await PaytmChecksum.generateSignature(JSON.stringify(paytmParams), "nX--key--2J");
      const paytmRequest = {
        body: paytmParams,
        head: {
          clientId: "C11",
          version: "v1",
          signature: checksum
        }
      };

      const response = await axios.post('https://securegw.paytm.in/paymentservices/qr/create', paytmRequest, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
  
      console.log("Result - ", response.data);
      const qrData = response.data.body.qrData;
      const port = "COM5";

      const deepLink = `PaytmPayments:?requestId=123;method=displayTxnQr;mid=test5P07128923987041;portName=${port};baudRate=115200;parity=0;dataBits=8;stopBits=1;order_id=${orderId};order_amount=${amount};qrcode_id=${qrData};currencySign=null;debugMode=1;posid=POS-1`;;

      const url= await generateAndUploadQR(qrData, orderId);
      
      console.log(url);
      
      // 
      // await sendEmail(url,email);
      
      console.log("the function ends");
      
      // sendEmailtwo()
      
      return url;


    } catch (error) {
      console.error('Error in createQRCode:', error);
      return null;
    }
}


async function uploadImageToS3(fileName) {
    const s3 = new AWS.S3();
    
      const uploadParams = {
        Bucket: 'dynamic-qr',// Replace with your bucket name
        Key: fileName, // The key (filename) under which the image will be stored in the bucket
        Body: fs.createReadStream(fileName), // Read the image file
        ACL: 'public-read', // Set the access control for the uploaded image
        ContentType: 'image/png', // Specify the content type of the image
        ContentDisposition: 'inline'
      };
      
      // Upload the image to the S3 bucket
      return new Promise((resolve, reject) => {
        s3.upload(uploadParams, (err, data) => {
          if (err) {
            console.error('Error uploading image:', err);
            reject(err);
          } else {
            console.log('Image uploaded successfully:', data.Location);
            resolve(data.Location);
          }
        });
      });
  }
  

  
  
async function generateQR(data,orderId,size=200){  
    const options = {
        errorCorrectionLevel: 'H',
        type: 'png',
        quality: 0.9,
        margin: 1,
        size: size
    };

    const fileName = `qrCode-${orderId}.png`; // Define a unique file name for each QR code
    return new Promise((resolve, reject) => {
      qr.toFile(fileName, data, options, (err) => {
        if (err) {
          console.error('Failed to generate QR code:', err);
          reject(err);
        } else {
          console.log('QR code generated successfully!');
          
          resolve(fileName);
        }
      });
    });
}



async function sendEmail(qrUrl, email ,emailSubject = "QR Code Generated", emailBody = `Here is the QR Code URL: ${qrUrl}`) {
  console.log("inside sendEmail funxtion")

    const transporter = nodemailer.createTransport({
        service: "gmail",
        secure: true,
        port: 465,
        auth: {
            user: "hufttestmail@gmail.com",
            pass: "daz lhnt"
        }
    });

    const receiver = {
        from: "hufttestmail@gmail.com",
        to: `${email}`,
        subject: emailSubject,
        text: emailBody
    };
    console.log(email);
    
    try{
      const res = await transporter.sendMail(receiver);
      console.log("mail sent",res);
    } catch(error) {
      console.log("err in sending mail",error);
    }
    
}

//recent chnages 14/05


async function generateAndUploadQR(data, orderId, size = 200) {
  const s3 = new AWS.S3();
    const options = {
        errorCorrectionLevel: 'H',
        type: 'png',
        quality: 0.9,
        margin: 1,
        size: size
    };

    const qrData = qri.imageSync(data, options); // Generate QR code image synchronously
    const key = `qrCode-${orderId}.png`; 

    
    const params = {
        Bucket: 'dynamic-qr',
        Key: key,
        Body: qrData,
        ContentType: 'image/png'
    };
    console.log("inside generate and ipload qr")
    return new Promise((resolve, reject) => {
      s3.upload(params, (err, data) => {
        if (err) {
          console.error('Error uploading image:', err);
          reject(err);
        } else {
          console.log('Image uploaded successfully:', data.Location);
          resolve(data.Location);
        }
      });
    });
}

// async function sendNotification(dataUrl,orderId,phoneNumber){
//   const url =  'https://devapi.headsupfortails.com/v1/notification/qr-notification'
//   const config = {
//     method: 'post',
//     url,
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': 'h6f329944t' //dev
//     },
//     body: {
//       "mobile": `${phoneNumber}`,
//       "qr":`${dataUrl}`,
//       "order_id": `${orderId}`,
//     }
//   };
//   await axios(config);
  
// }







//   https://devapi.headsupfortails.com/v1/notification/qr-notification
// request : body
// {
//   "mobile": "9810297026",
//   "qr":"https://dynamic-qr.s3.amazonaws.com/qrCode-213123131222.png",
//   "order_id":"HUFT11022"
// }