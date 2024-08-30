import { PaytmChecksum } from './PaytmChecksum.js';
import axios from 'axios';

export const handler = async (event) => {
  
  const pjson=JSON.parse(event.body);
  console.log(pjson);
  
  const result=await checkTransactionStatus(pjson);
  console.log(result);
  
  const response = {
    statusCode: 200,
    body: JSON.stringify( {result} )
  };
  
  return response;
  
};

async function checkTransactionStatus(data) {
  
  const paytmParams = { body: data };

  try {
    const checksum = await PaytmChecksum.generateSignature(JSON.stringify(paytmParams.body), "nX&2J");
    paytmParams.head = { signature: checksum };

    const config = {
      method: 'post',
      url: 'https://securegw.paytm.in/v3/order/status',
      headers: { 
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(paytmParams)
    };

    const response = await axios(config);
    console.log('Response: ', response.data);
    
    return response.data;
    
  } catch (error) {
    console.error('Request error:', error);
  }
}
