using Duale.Api.Domain;
namespace Duale.Api.Services;

// Sends verification codes. It reuses the email / sms notification providers, so the day a provider is registered
// (INotificationProvider with Channel "email" or "sms") both notifications and verification codes start working.
// Until then the API says so instead of pretending a code was sent. In Development the code is written to the log.
public interface IVerificationDelivery
{
    bool CanSend(string channel);   // "email" | "sms"
    Task SendAsync(string channel, string target, string code, DateTime expiresAt, CancellationToken ct);
}

public class VerificationDelivery(IEnumerable<INotificationProvider> providers, IHostEnvironment env, ILogger<VerificationDelivery> log) : IVerificationDelivery
{
    public bool CanSend(string channel) => providers.Any(p => p.Channel == channel) || env.IsDevelopment();

    public async Task SendAsync(string channel, string target, string code, DateTime expiresAt, CancellationToken ct)
    {
        var provider = providers.FirstOrDefault(p => p.Channel == channel);
        if (provider is null)
        {
            if (env.IsDevelopment()) log.LogWarning("DEV ONLY {Channel} verification code for {Target}: {Code}", channel, target, code);
            return;
        }
        var result = await provider.SendAsync(new DeliveryMessage(channel, target, "Your Duale verification code", $"Your verification code is {code}. It expires at {expiresAt:HH:mm} UTC.", Guid.NewGuid().ToString()), ct);
        if (!result.Ok) throw new InvalidOperationException(result.Error ?? "Delivery failed.");
    }
}

// Password recovery by email, through the same provider as verification codes (Brevo, or SMTP). Never throws: the endpoint must answer the same whether or not the address exists.
public class EmailRecoveryDelivery(IEnumerable<INotificationProvider> providers, ILogger<EmailRecoveryDelivery> log) : IRecoveryDelivery
{
    public async Task SendAsync(string email, string token, DateTime expiresAt, CancellationToken ct)
    {
        var provider = providers.FirstOrDefault(p => p.Channel == "email");
        if (provider is null) { log.LogError("Password recovery requested but no email provider is configured; nothing was sent."); return; }
        try
        {
            var body = $"Your Duale password recovery token is:\n\n{token}\n\nOpen the Account recovery page, paste this token and choose a new password (at least 12 characters). It expires at {expiresAt:HH:mm} UTC and works once. If you did not ask for this, ignore this email.";
            var result = await provider.SendAsync(new DeliveryMessage("email", email, "Reset your Duale password", body, Guid.NewGuid().ToString()), ct);
            if (!result.Ok) log.LogError("Recovery email could not be sent: {Error}", result.Error);
        }
        catch (Exception ex) { log.LogError(ex, "Recovery email could not be sent"); }
    }
}
