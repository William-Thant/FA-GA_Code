const axios = require("axios");

exports.generateQrCode = async (req, res) => {
  const { cartTotal } = req.body;
  const totalAmount = parseFloat(cartTotal);
  console.log('NETS Payment - Cart Total:', totalAmount);
  
  try {
    const requestBody = {
      txn_id: "sandbox_nets|m|8ff8e5b6-d43e-4786-8ac5-7accf8c5bd9b", // Default for testing
      amt_in_dollars: totalAmount,
      notify_mobile: 0,
    };

    const response = await axios.post(
      `https://sandbox.nets.openapipaas.com/api/v1/common/payments/nets-qr/request`,
      requestBody,
      {
        headers: {
          "api-key": process.env.NETS_API_KEY,
          "project-id": process.env.NETS_PROJECT_ID,
        },
      }
    );

    const qrData = response.data.result.data;
    console.log('NETS QR Data:', qrData);

    if (
      qrData.response_code === "00" &&
      qrData.txn_status === 1 &&
      qrData.qr_code
    ) {
      console.log("QR code generated successfully");

      // Store transaction retrieval reference for later use
      const txnRetrievalRef = qrData.txn_retrieval_ref;

      // Render the QR code page with required data
      res.render("netsQr", {
        total: totalAmount,
        title: "Scan to Pay",
        qrCodeUrl: `data:image/png;base64,${qrData.qr_code}`,
        txnRetrievalRef: txnRetrievalRef,
        networkCode: qrData.network_status,
        timer: 300, // Timer in seconds (5 minutes)
        fullNetsResponse: response.data,
        apiKey: process.env.NETS_API_KEY,
        projectId: process.env.NETS_PROJECT_ID,
        user: req.session.user
      });
    } else {
      // Handle partial or failed responses
      let errorMsg = "An error occurred while generating the QR code.";
      if (qrData.network_status !== 0) {
        errorMsg = qrData.error_message || "Transaction failed. Please try again.";
      }
      res.render("netsTxnFailStatus", {
        title: "Payment Error",
        message: errorMsg,
        user: req.session.user
      });
    }
  } catch (error) {
    console.error("Error in generateQrCode:", error.message);
    res.redirect("/nets-qr/fail");
  }
};
