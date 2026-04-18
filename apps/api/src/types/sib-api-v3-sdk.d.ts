declare module "sib-api-v3-sdk" {
  export class ApiClient {
    static instance: ApiClient;
    authentications: Record<string, { apiKey: string } | undefined>;
  }

  export class SendSmtpEmailAttachment {
    content?: string;
    name?: string;
    url?: string;
  }

  export class SendSmtpEmail {
    subject?: string;
    htmlContent?: string;
    sender?: { email: string; name?: string };
    to?: Array<{ email: string; name?: string }>;
    attachment?: SendSmtpEmailAttachment[];
  }

  export class TransactionalEmailsApi {
    sendTransacEmail(
      sendSmtpEmail: SendSmtpEmail,
    ): Promise<{ response: unknown; body: unknown }>;
  }

  const SibApiV3Sdk: {
    ApiClient: typeof ApiClient;
    SendSmtpEmail: typeof SendSmtpEmail;
    SendSmtpEmailAttachment: typeof SendSmtpEmailAttachment;
    TransactionalEmailsApi: typeof TransactionalEmailsApi;
  };

  export default SibApiV3Sdk;
}
