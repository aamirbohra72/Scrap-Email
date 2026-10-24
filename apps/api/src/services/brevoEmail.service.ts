import SibApiV3Sdk from "sib-api-v3-sdk";

export type SendAttachmentInput = {
  /** Base64-encoded file bytes (no data: URL prefix). */
  contentBase64: string;
  /** Filename including extension, e.g. Resume.pdf */
  name: string;
};

export type SendTransactionalEmailInput = {
  apiKey: string;
  senderEmail: string;
  to: string;
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: SendAttachmentInput[];
};

export async function sendTransactionalEmail(
  input: SendTransactionalEmailInput,
): Promise<void> {
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKeyAuth = defaultClient.authentications["api-key"];
  if (!apiKeyAuth) {
    throw new Error("Brevo API client is missing api-key authentication");
  }
  apiKeyAuth.apiKey = input.apiKey;

  const api = new SibApiV3Sdk.TransactionalEmailsApi();
  const body = new SibApiV3Sdk.SendSmtpEmail();
  body.subject = input.subject;
  body.htmlContent = input.html;
  body.sender = { email: input.senderEmail };
  body.to = [{ email: input.to }];
  if (input.bcc?.length) {
    const emailBody = body as typeof body & { bcc?: Array<{ email: string }> };
    emailBody.bcc = input.bcc.map((email) => ({ email }));
  }

  if (input.attachments?.length) {
    body.attachment = input.attachments.map((a) => {
      const att = new SibApiV3Sdk.SendSmtpEmailAttachment();
      att.content = a.contentBase64;
      att.name = a.name;
      return att;
    });
  }

  await api.sendTransacEmail(body);
}
