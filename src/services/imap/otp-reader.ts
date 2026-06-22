import { ImapFlow } from "imapflow";

const OTP_SUBJECT = "OTP for Sign In in ERP Portal of IIT Kharagpur";

export class ImapOtpReader {
  private client: ImapFlow;

  constructor(email: string, appPassword: string) {
    this.client = new ImapFlow({
      host: "imap.gmail.com",
      port: 993,
      secure: true,
      auth: { user: email, pass: appPassword },
      logger: false,
    });
  }

  async connect(): Promise<void> {
    await this.client.connect();
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.logout();
    } catch {
      // dis...safe to ignore
    }
  }

  // Get the UID of the latest OTP email (or null if none exist)
  private async getLatestOtpUid(): Promise<number | null> {
    const uids = await this.client.search({ subject: OTP_SUBJECT });
    if (!uids || uids.length === 0) return null;
    return uids[uids.length - 1] ?? null;
  }

  // Extract 6-digit OTP
  private extractOtp(rawSource: Buffer): string | null {
    const text = rawSource.toString();
    const match = text.match(/\b(\d{6})\b/);
    return match && match[1] ? match[1] : null;
  }

  // Poll for a NEW OTP email that arrives after `beforeUid`
  async waitForOtp(
    beforeUid: number,
    timeoutMs: number = 60000,
    pollIntervalMs: number = 2000
  ): Promise<string> {
    const deadline = Date.now() + timeoutMs;

    const lock = await this.client.getMailboxLock("INBOX");
    try {
      while (Date.now() < deadline) {
        // NOOP forces server to send pending notifications
        await this.client.noop();

        // Fetch new messages with UID > beforeUid (capped at 10 per cycle)
        const afterUid = beforeUid + 1;
        let checked = 0;
        for await (const msg of this.client.fetch(`${afterUid}:*`, {
          source: true,
          uid: true,
        })) {
          if (++checked > 10) break;  // safety cap
          if (msg.uid > beforeUid && msg.source) {
            const text = msg.source.toString();
            if (text.includes(OTP_SUBJECT)) {
              const otp = this.extractOtp(msg.source);
              if (otp) return otp;
            }
          }
        }

        // wait b4 polling agn
        await new Promise((r) => setTimeout(r, pollIntervalMs));
      }

      throw new Error("Timed out waiting for OTP email");
    } finally {
      lock.release();
    }
  }

  async snapshotLatestUid(): Promise<number> {
    const lock = await this.client.getMailboxLock("INBOX");
    try {
      const msg = await this.client.fetchOne("*", { uid: true });
      if (!msg) throw new Error("INBOX is empty");
      return msg.uid;
    } finally {
      lock.release();
    }
  }
}