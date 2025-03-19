/**
 * assets.js (or assets/index.js)
 */

const moment = require("moment-timezone");

/**
 * 1) appointmentConfirmation
 *    - Called when a NEW appointment is created.
 *    - Displays the date/time in Asia/Kolkata time zone (Indian Standard Time).
 *
 * @param {Object} appointment - Contains appointment data
 * @param {Object} property - Contains property data
 * @param {String} googleMapsUrl - URL to view the property location
 */
function appointmentConfirmation(appointment, property, googleMapsUrl) {
	const {
		agentName,
		clientName,
		appointmentDate,
		appointmentTime,
		phone,
		email,
		notes,
	} = appointment;

	const { propertyName, propertyCity, propertyState, propertyAddress } =
		property || {};

	// Convert the appointmentDate to "Asia/Kolkata" (Indian time)
	const dateString = moment(appointmentDate)
		.tz("Asia/Kolkata")
		.format("dddd, MMMM Do YYYY, h:mm A");

	return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>New Appointment Scheduled</title>
      <style>
        /* --------------------------------- */
        /* Root Variables & Responsive Styling */
        /* --------------------------------- */
        :root {
          --primaryBlue: #1f3a52;
          --primaryBlueDarker: #17293b;
          --orangeDark: #6f2d00;
          --orangeLight: #ffe4cc;
          --mainGrey: #f8f8f8;
          --darkGrey: #5a5a5a;
          --mainWhite: #ffffff;
          --mainBlack: #222222;
          --border-color-light: #e0e0e0;
          --box-shadow-light: 0 2px 4px rgba(0, 0, 0, 0.1);
          --button-bg-primary: var(--primaryBlue);
          --button-font-color: var(--mainWhite);

          --primary-color: var(--primaryBlue);
          --primary-color-light: #2a5070;
          --primary-color-lighter: #3a6a92;
          --primary-color-dark: var(--primaryBlueDarker);
          --primary-color-darker: #0f1c27;

          --secondary-color: var(--orangeDark);
          --accent-color-1: var(--orangeLight);

          --neutral-light: var(--mainGrey);
          --neutral-dark: var(--darkGrey);

          --main-transition: all 0.3s ease-in-out;
          --main-spacing: 0.3rem;
        }

        body {
          font-family: Arial, sans-serif;
          background-color: var(--neutral-light);
          color: var(--mainBlack);
          margin: 0;
          padding: 0;
        }

        .container {
          background-color: var(--mainWhite);
          max-width: 600px;
          margin: 2rem auto;
          border-radius: 8px;
          box-shadow: var(--box-shadow-light);
          padding: 1.5rem;
        }

        h1, h2, h3 {
          color: var(--primary-color);
          margin-top: 0;
        }

        .info-row {
          margin: 0.5rem 0;
        }

        .button {
          display: inline-block;
          padding: 0.75rem 1rem;
          background-color: var(--button-bg-primary);
          color: var(--button-font-color);
          text-decoration: none;
          border-radius: 4px;
          margin-top: 1rem;
        }

        .footer {
          text-align: center;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color-light);
          color: var(--neutral-dark);
          font-size: 0.9rem;
        }

        @media (max-width: 600px) {
          .container {
            margin: 1rem;
            padding: 1rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>New Appointment Scheduled!</h1>
        <p>Hello <strong>${agentName || "Agent"}</strong>,</p>
        <p>
          A new appointment has been created with
          <strong>${clientName || "Client"}</strong>.
        </p>

        <div class="info-row">
          <strong>Date (IST):</strong> ${dateString}<br/>
          <strong>Time:</strong> ${appointmentTime}
        </div>
        <div class="info-row">
          <strong>Client Email:</strong> ${email}<br/>
          <strong>Client Phone:</strong> ${phone}
        </div>
        <div class="info-row">
          <strong>Property:</strong> ${propertyName || "N/A"}<br/>
          <strong>Address:</strong>
            ${propertyAddress || "N/A"},
            ${propertyCity || "N/A"},
            ${propertyState || "N/A"}
        </div>

        <p>
          <a
            class="button"
            href="${googleMapsUrl || "#"}"
            target="_blank"
          >
            View Property on Google Maps
          </a>
        </p>

        <div class="info-row">
          <strong>Notes:</strong> ${notes || "No additional notes"}
        </div>

        <div class="footer">
          &copy; ${new Date().getFullYear()} Your Real Estate Company. All rights reserved.
        </div>
      </div>
    </body>
  </html>
  `;
}

/**
 * 2) appointmentUpdate
 *    - Called when an existing appointment is UPDATED.
 *    - Displays the appointmentDate in Asia/Kolkata time zone.
 */
function appointmentUpdate({ appointment, property, googleMapsUrl }) {
	const {
		agentName,
		clientName,
		appointmentDate,
		appointmentTime,
		phone,
		email,
		notes,
	} = appointment;

	const { propertyName, propertyCity, propertyState, propertyAddress } =
		property || {};

	// Convert the appointmentDate to "Asia/Kolkata" (Indian time)
	const dateString = moment(appointmentDate)
		.tz("Asia/Kolkata")
		.format("dddd, MMMM Do YYYY, h:mm A");

	return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>Appointment Updated</title>
      <style>
        /* --------------------------------- */
        /* Root Variables & Responsive Styling */
        /* --------------------------------- */
        :root {
          --primaryBlue: #1f3a52;
          --primaryBlueDarker: #17293b;
          --orangeDark: #6f2d00;
          --orangeLight: #ffe4cc;
          --mainGrey: #f8f8f8;
          --darkGrey: #5a5a5a;
          --mainWhite: #ffffff;
          --mainBlack: #222222;
          --border-color-light: #e0e0e0;
          --box-shadow-light: 0 2px 4px rgba(0, 0, 0, 0.1);
          --button-bg-primary: var(--primaryBlue);
          --button-font-color: var(--mainWhite);

          --primary-color: var(--primaryBlue);
          --primary-color-dark: var(--primaryBlueDarker);
          --neutral-light: var(--mainGrey);
          --neutral-dark: var(--darkGrey);

          --main-transition: all 0.3s ease-in-out;
          --main-spacing: 0.3rem;
        }

        body {
          font-family: Arial, sans-serif;
          background-color: var(--neutral-light);
          color: var(--mainBlack);
          margin: 0;
          padding: 0;
        }

        .container {
          background-color: var(--mainWhite);
          max-width: 600px;
          margin: 2rem auto;
          border-radius: 8px;
          box-shadow: var(--box-shadow-light);
          padding: 1.5rem;
        }

        h1 {
          color: var(--primary-color);
          margin-top: 0;
        }

        .info-row {
          margin: 0.5rem 0;
        }

        .button {
          display: inline-block;
          padding: 0.75rem 1rem;
          background-color: var(--button-bg-primary);
          color: var(--button-font-color);
          text-decoration: none;
          border-radius: 4px;
          margin-top: 1rem;
        }

        .footer {
          text-align: center;
          margin-top: 1.5rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border-color-light);
          color: var(--neutral-dark);
          font-size: 0.9rem;
        }

        @media (max-width: 600px) {
          .container {
            margin: 1rem;
            padding: 1rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Appointment Updated!</h1>
        <p>
          Hello <strong>${agentName || "Agent"}</strong>,<br/>
          The following appointment has been updated:
        </p>
        <div class="info-row">
          <strong>Client Name:</strong> ${clientName}<br/>
          <strong>Date (IST):</strong> ${dateString}<br/>
          <strong>Time:</strong> ${appointmentTime}
        </div>
        <div class="info-row">
          <strong>Property:</strong> ${propertyName || "N/A"}<br/>
          <strong>Address:</strong>
            ${propertyAddress || "N/A"},
            ${propertyCity || "N/A"},
            ${propertyState || "N/A"}
        </div>
        <p>
          <a
            class="button"
            href="${googleMapsUrl || "#"}"
            target="_blank"
          >
            View Updated Location
          </a>
        </p>
        <div class="info-row">
          <strong>Client Email:</strong> ${email}<br/>
          <strong>Client Phone:</strong> ${phone}<br/>
          <strong>Notes:</strong> ${notes || "No additional notes"}
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} Your Real Estate Company. All rights reserved.
        </div>
      </div>
    </body>
  </html>
  `;
}

/**
 * 3) newSupportCaseEmail
 *    - Called when a new support case is opened.
 *    - Displays the case creation date in Asia/Kolkata time zone.
 *
 * @param {Object} supportCase  - The support case data
 * @param {String} hotelName    - The name of the hotel
 */
function newSupportCaseEmail(supportCase, hotelName) {
	// Convert creation date to Indian time (Asia/Kolkata)
	const createdAtIndia = supportCase.createdAt
		? moment(supportCase.createdAt)
				.tz("Asia/Kolkata")
				.format("dddd, MMMM Do YYYY, h:mm A")
		: moment().tz("Asia/Kolkata").format("dddd, MMMM Do YYYY, h:mm A");

	// Extract first conversation entry for top-level inquiry details
	const firstMessage = supportCase?.conversation?.[0] || {};

	// Safe fallback if no inquiry details
	const inquiryAbout = firstMessage.inquiryAbout || "N/A";
	const inquiryDetails = firstMessage.inquiryDetails || "N/A";

	// The openedBy field (e.g., "client", "hotel owner", "super admin")
	const openedBy = supportCase.openedBy || "Unknown";

	// Display name(s) from the schema
	const displayName1 = supportCase.displayName1 || "N/A";

	return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>New Support Case</title>
      <style>
        /* --------------------------------- */
        /* Root Variables & Responsive Styling */
        /* --------------------------------- */
        :root {
          --primaryBlue: #1f3a52;
          --primaryBlueDarker: #17293b;
          --orangeDark: #6f2d00;
          --orangeLight: #ffe4cc;
          --mainGrey: #f8f8f8;
          --darkGrey: #5a5a5a;
          --mainWhite: #ffffff;
          --mainBlack: #222222;
          --border-color-light: #e0e0e0;
          --box-shadow-light: 0 2px 4px rgba(0, 0, 0, 0.1);
          --button-bg-primary: var(--primaryBlue);
          --button-font-color: var(--mainWhite);

          --primary-color: var(--primaryBlue);
          --primary-color-dark: var(--primaryBlueDarker);
          --neutral-light: var(--mainGrey);
          --neutral-dark: var(--darkGrey);

          --main-transition: all 0.3s ease-in-out;
          --main-spacing: 0.3rem;
        }

        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: var(--neutral-light);
          color: var(--mainBlack);
        }

        .container {
          background-color: var(--mainWhite);
          max-width: 700px;
          margin: 30px auto;
          padding: 20px;
          border-radius: 8px;
          box-shadow: var(--box-shadow-light);
        }

        .header {
          background-color: var(--primaryBlueDarker);
          color: var(--mainWhite);
          text-align: center;
          padding: 20px;
          border-radius: 8px 8px 0 0;
        }

        .header h1 {
          margin: 0;
          font-size: 1.8rem;
        }

        .content {
          padding: 20px;
          line-height: 1.6;
        }

        .content p {
          margin-bottom: 1em;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 15px;
        }

        th, td {
          border: 1px solid var(--border-color-light);
          padding: 10px;
          text-align: left;
        }

        th {
          background-color: var(--primaryBlueDarker);
          color: var(--mainWhite);
        }

        .button-container {
          text-align: center;
          margin: 25px 0;
        }

        .button {
          font-size: 1.1rem;
          background: var(--primaryBlue);
          color: var(--button-font-color);
          text-decoration: none;
          padding: 10px 25px;
          border-radius: 6px;
          font-weight: bold;
          border: none;
          transition: background 0.3s ease-in-out;
          display: inline-block;
        }

        .button:hover {
          background: #2a5070; /* slightly lighter shade of primaryBlue */
        }

        .footer {
          background-color: var(--primaryBlueDarker);
          color: var(--mainWhite);
          text-align: center;
          padding: 15px;
          font-size: 0.9rem;
          border-radius: 0 0 8px 8px;
        }

        .footer a {
          color: var(--orangeLight);
          text-decoration: none;
          font-weight: bold;
        }
        .footer a:hover {
          text-decoration: underline;
        }

        @media (max-width: 600px) {
          .header h1 {
            font-size: 1.4rem;
          }
          table, th, td {
            font-size: 0.9rem;
          }
          .button {
            font-size: 1rem;
            padding: 10px 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Header -->
        <div class="header">
          <h1>New Support Case</h1>
        </div>

        <!-- Content -->
        <div class="content">
          <p>Hi Jannat Booking Admins,</p>
          <p>There's a new support case opened for <strong>${hotelName}</strong>.</p>
          <p>Below are some details regarding this case:</p>

          <table>
            <tr>
              <th>Case ID</th>
              <td>${supportCase._id}</td>
            </tr>
            <tr>
              <th>Created At (IST)</th>
              <td>${createdAtIndia}</td>
            </tr>
            <tr>
              <th>Opened By</th>
              <td>${openedBy}</td>
            </tr>
            <tr>
              <th>Display Name</th>
              <td>${displayName1}</td>
            </tr>
            <tr>
              <th>Inquiry About</th>
              <td>${inquiryAbout}</td>
            </tr>
            <tr>
              <th>Inquiry Details</th>
              <td>${inquiryDetails}</td>
            </tr>
          </table>

          <div class="button-container">
            <a
              href="https://xhotelpro.com/admin/customer-service?tab=active-client-cases"
              class="button"
              target="_blank"
              rel="noopener noreferrer"
            >
              View Support Cases
            </a>
          </div>

          <p>
            Please log in to your admin panel to review and respond to this new case.
          </p>
        </div>

        <!-- Footer -->
        <div class="footer">
          <p>
            &copy; ${new Date().getFullYear()} Jannat Booking.
            Need help? <a href="https://jannatbooking.com">Contact us</a>
          </p>
        </div>
      </div>
    </body>
  </html>
  `;
}

/**
 * Exports
 */
module.exports = {
	appointmentConfirmation,
	appointmentUpdate,
	newSupportCaseEmail,
};
