// Keep the policy copy aligned across mobile and web.
export const legalDocuments = {
  "privacy": {
    "title": "Privacy Policy",
    "updated": "6 November 2026",
    "sections": [
      {
        "heading": "Who uses this information",
        "body": "HostelHive helps students discover accommodation and helps hostel administrators and assigned staff manage a stay. HostelHive project operators maintain the service; your hostel administration manages its property and resident records. For a question about your information, contact your hostel administration using the reception details on the hostel page, or your project/campus coordinator if you do not yet have a hostel."
      },
      {
        "heading": "Information we collect",
        "body": "Account records include your name, email, password hash, role and any phone number or profile image you provide. Booking applications can include identity-document images, emergency contact details and acceptance records. We also keep room and stay history, invoices and payment references, complaints and repair photos, staff assignments, reviews, assistant conversations and notification/device-token records needed for these features. Do not put passwords, card details or unnecessary identity information in reviews, complaints or assistant messages."
      },
      {
        "heading": "Why we use it and who can see it",
        "body": "We use these records to verify accounts, process hostel applications, manage accommodation, confirm billing, handle repairs, send service updates and answer hostel questions. Your hostel administrator can access records needed for hostel operations. Assigned staff can access relevant work details, including complaint and room information. Hostel listing information and reviews, including the reviewer name, rating, date and comment, can be visible to other people browsing the service. These public areas are not private messages."
      },
      {
        "heading": "Services that process information",
        "body": "Depending on deployment configuration, Stripe processes card checkout and connected-hostel payouts; ImageKit stores uploaded images; the configured email provider delivers verification and reset codes; Firebase delivers device notifications; and Groq processes assistant requests with relevant conversation and hostel context. The application database stores service records. These providers may process data in other countries under their own terms and security practices. Card details are entered on Stripe checkout rather than stored as card numbers in HostelHive."
      },
      {
        "heading": "Blockchain audit records",
        "body": "Selected payment and critical-complaint records can have a cryptographic hash anchored to a public blockchain, with a public transaction reference and timestamp. The chain transaction contains the hash rather than the full complaint or payment document. Public blockchain transactions cannot ordinarily be edited or removed by HostelHive. Other associated account and service records remain in the application database. Some project deployments use simulated audit references instead of a public transaction."
      },
      {
        "heading": "Storage, retention and your choices",
        "body": "Sign-in tokens and cached account information are stored on your device/browser to maintain your session. Service records and uploaded files are retained for hostel administration, billing history, dispute handling and audit needs; this version has no universal automatic deletion schedule. You can update supported profile fields, sign out and control notification/camera/photo permissions in device settings. Ask your hostel administration or project coordinator to review requests for access, correction or removal of records. Some billing, dispute or immutable blockchain records may need to remain; a request is not a promise that every record can be erased immediately."
      },
      {
        "heading": "Security and updates",
        "body": "Protect your password and verification codes, use only an account you are authorized to access, and sign out on shared devices. No service can guarantee complete security. Report suspected unauthorized access to your hostel administration or project coordinator. This notice will be updated when the service or its data practices change; review the date above."
      }
    ]
  },
  "terms": {
    "title": "Terms of Service",
    "updated": "6 November 2026",
    "sections": [
      {
        "heading": "Using HostelHive",
        "body": "Use HostelHive only for legitimate accommodation and hostel-service requests. Provide accurate information, use an email account you control and keep your login and verification codes private. Do not access another account or submit another person's identity documents without authority."
      },
      {
        "heading": "Booking and residency",
        "body": "A submitted application is a request, not a confirmed room or physical check-in. Hostel administration reviews applications; approval, required payment and check-in are separate steps. Room availability can change before a request is processed. Read the property rules, rent and other information before applying, and contact the hostel about details that are unclear."
      },
      {
        "heading": "Payments and receipts",
        "body": "Card checkout is processed by Stripe when the hostel has completed its payment setup. Returning from checkout is not proof of payment; the invoice must be confirmed by the server. Other payments recorded by the hostel may appear in your billing history. Contact hostel administration promptly about a wrong charge, missing confirmation, cancellation or refund request. HostelHive does not promise an automatic refund or replace the hostel's applicable accommodation agreement."
      },
      {
        "heading": "Complaints, reviews and assistant",
        "body": "Submit genuine complaints and relevant photos, and use reviews to describe your own stay fairly. Do not post sensitive personal information, threats or fabricated reports. Staff completion and administrative/student verification are separate stages. The assistant can help explain recorded hostel information, but responses can be incomplete or incorrect; confirm important accommodation, safety, financial or emergency decisions with a responsible person. Use local emergency services for an emergency rather than waiting for an app response."
      },
      {
        "heading": "Property responsibility and access",
        "body": "The hostel administration is responsible for the property information, accommodation service and staff actions it manages. Staff must use only the work assigned to them. Service availability may be affected by connectivity, third-party services or maintenance. Follow the hostel's published rules and the law that applies to your use; these terms do not remove rights you have under applicable law."
      },
      {
        "heading": "Privacy and questions",
        "body": "Read the Privacy Policy to understand information collection, public reviews, third-party processing and audit records. Raise accommodation and record-correction questions with your hostel administration using its listed reception contact. If you have no hostel yet, contact your project or campus coordinator for account help."
      }
    ]
  },
  "guidelines": {
    "title": "Administrator Guidelines",
    "updated": "6 November 2026",
    "sections": [
      {
        "heading": "Manage only your authorized property",
        "body": "Keep property details, room capacity, rent, facilities, rules and contact information accurate. Save a new property as a private draft, review it and publish only when it is ready for students. Do not access or alter another hostel's records."
      },
      {
        "heading": "Protect resident and staff information",
        "body": "Use identity documents, emergency contacts, complaint photos, account and billing records only for legitimate hostel operations. Do not copy them into public descriptions, reviews or chatbot knowledge. Invite staff using the correct email and allow the invited person to verify the account and set a password. Review access when a staff member leaves."
      },
      {
        "heading": "Process bookings and money accurately",
        "body": "Review applications before approval, confirm required payment before check-in and record physical check-in/check-out accurately. Complete Stripe onboarding to enable card collection. Do not describe an unconfirmed checkout as paid; manual payment entries must reflect money actually received outside card checkout. Handle cancellation, billing corrections and refund requests with the resident and payment provider as appropriate."
      },
      {
        "heading": "Verify work and publish useful information",
        "body": "Assign complaints and tasks to appropriate active staff. Inspect repair evidence before confirming resolution and respond to unresolved reports. Keep house rules and assistant knowledge current; only include information students or residents should receive. The assistant is not an emergency response service."
      },
      {
        "heading": "Data requests and accountability",
        "body": "Read and follow the Privacy Policy. Review requests for access, correction or removal of hostel records with the project operators. Limit unnecessary copies and preserve records genuinely needed for billing, disputes or audit. Do not promise deletion of public blockchain transactions. Report suspected unauthorized access or data exposure to the project operators promptly."
      }
    ]
  }
} as const;
export type LegalDocumentKind = keyof typeof legalDocuments;
