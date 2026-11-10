using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Duale.Api.Auth;
using Duale.Api.Data;
using Duale.Api.Domain;
using Duale.Api.Services;
using Microsoft.EntityFrameworkCore;
using static Duale.Api.Endpoints;
using static Duale.Api.Phase2Endpoints;
namespace Duale.Api;

public record RatingReq(int? Stars, string? Comment);
public record VerifyConfirmReq(string? Code);

// Technician ratings and email / phone verification.
public static class Phase8Endpoints
{
    const int MaxCodeAttempts = 5;

    static string Hash(Guid userId, string channel, string target, string code) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{userId:N}|{channel}|{target}|{code}"))).ToLowerInvariant();

    // channel is "email" or "phone"; the delivery channel for a phone number is "sms".
    static async Task<IResult> RequestCode(string channel, string? target, Guid uid, AppDbContext db, IVerificationDelivery delivery, HttpContext http, CancellationToken ct)
    {
        target = target?.Trim();
        if (string.IsNullOrWhiteSpace(target)) return Bad(channel == "email" ? "There is no email address on this account." : "Add a phone number to your technician profile first.");
        var via = channel == "email" ? "email" : "sms";
        if (!delivery.CanSend(via)) return Results.Json(new { error = "Verification codes cannot be sent yet: no email/SMS provider is configured." }, statusCode: 503);
        var now = DateTime.UtcNow;
        if (await db.VerificationCodes.AnyAsync(x => x.UserId == uid && x.Channel == channel && x.CreatedAt > now.AddSeconds(-60), ct))
            return Results.Json(new { error = "Wait a minute before asking for another code." }, statusCode: 429);
        foreach (var old in await db.VerificationCodes.Where(x => x.UserId == uid && x.Channel == channel && x.UsedAt == null).ToListAsync(ct)) old.UsedAt = now;
        var code = RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");
        var expires = now.AddMinutes(15);
        db.VerificationCodes.Add(new VerificationCode { UserId = uid, Channel = channel, Target = target, CodeHash = Hash(uid, channel, target, code), ExpiresAt = expires });
        db.Audit(http, uid, $"user.{channel}_verification_requested", "user", uid.ToString());
        await db.SaveChangesAsync(ct);
        try { await delivery.SendAsync(via, target, code, expires, ct); }
        catch (Exception ex) when (ex is not OperationCanceledException) { return Results.Json(new { error = "The code could not be sent. Try again later." }, statusCode: 502); }
        return Results.NoContent();
    }

    // Checks the code for the address as it is right now (changing the address invalidates earlier codes). On success the code is
    // marked used but NOT saved: the caller saves it together with the verified flag.
    static async Task<(bool Ok, string? Error)> CheckCode(string channel, string target, Guid uid, string? code, AppDbContext db, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var c = await db.VerificationCodes.Where(x => x.UserId == uid && x.Channel == channel && x.UsedAt == null && x.ExpiresAt > now)
            .OrderByDescending(x => x.CreatedAt).FirstOrDefaultAsync(ct);
        if (c is null || c.Target != target) return (false, "Invalid or expired code.");
        if (c.Attempts >= MaxCodeAttempts) { c.UsedAt = now; await db.SaveChangesAsync(ct); return (false, "Too many attempts. Request a new code."); }
        c.Attempts++;
        var expected = Encoding.UTF8.GetBytes(c.CodeHash);
        var given = Encoding.UTF8.GetBytes(Hash(uid, channel, target, (code ?? "").Trim()));
        if (!CryptographicOperations.FixedTimeEquals(expected, given)) { await db.SaveChangesAsync(ct); return (false, "Invalid or expired code."); }
        c.UsedAt = now;
        return (true, null);
    }

    public static void Map(RouteGroupBuilder api)
    {
        // ======== Ratings ========
        api.MapPost("/companies/{id:guid}/jobs/{jobId:guid}/rating", async Task<IResult> (Guid id, Guid jobId, RatingReq r, ClaimsPrincipal p, AppDbContext db, AccessService access, HttpContext http, CancellationToken ct) =>
        {
            var uid = Uid(p);
            if (Deny(await access.Company(uid, id, "job.review", ct)) is { } d) return d;
            if (r.Stars is null or < 1 or > 5) return Bad("stars must be a whole number from 1 to 5.");
            var comment = r.Comment?.Trim();
            if (comment is { Length: > 1000 }) return Bad("comment must be at most 1000 characters.");
            var j = await LoadJob(db, id, jobId, ct); if (j is null) return Results.NotFound();
            if (j.Status != JobStatus.Completed) return Results.Conflict(new { error = "Only approved (completed) jobs can be rated." });
            var a = await db.Assignments.FirstOrDefaultAsync(x => x.JobId == jobId && x.Status == AssignmentStatus.Accepted, ct);
            if (a is null) return Results.Conflict(new { error = "This job has no accepted technician to rate." });
            var tech = await db.Technicians.FirstAsync(t => t.Id == a.TechnicianId, ct);
            if (tech.UserId == uid) return Forbidden();   // nobody rates themselves
            if (await db.JobRatings.AnyAsync(x => x.JobId == jobId, ct)) return Results.Conflict(new { error = "This job has already been rated." });
            var rating = new JobRating { JobId = jobId, CompanyId = id, TechnicianId = tech.Id, Stars = r.Stars.Value, Comment = string.IsNullOrEmpty(comment) ? null : comment, RatedBy = uid };
            db.JobRatings.Add(rating);
            JobFlow.Notify(db, tech.UserId, id, "job.rated", "You received a rating", $"Job {j.Reference} was rated {rating.Stars} out of 5.");
            db.Audit(http, uid, "job.rated", "job", jobId.ToString(), id, new { rating.Stars });
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { return Results.Conflict(new { error = "This job has already been rated." }); }
            return Results.Created($"/companies/{id}/jobs/{jobId}/rating", new { rating.Id, rating.Stars, rating.Comment });
        });

        api.MapGet("/companies/{id:guid}/jobs/{jobId:guid}/rating", async Task<IResult> (Guid id, Guid jobId, ClaimsPrincipal p, AppDbContext db, AccessService access, CancellationToken ct) =>
        {
            if (Deny(await access.Company(Uid(p), id, "job.read", ct)) is { } d) return d;
            var j = await LoadJob(db, id, jobId, ct); if (j is null) return Results.NotFound();
            var x = await db.JobRatings.Where(q => q.JobId == jobId).Select(q => new { q.Stars, q.Comment, q.CreatedAt }).FirstOrDefaultAsync(ct);
            return Results.Ok(new { rated = x is not null, stars = x == null ? (int?)null : x.Stars, comment = x == null ? null : x.Comment, createdAt = x == null ? (DateTime?)null : x.CreatedAt });
        });

        api.MapGet("/technicians/me/ratings", async Task<IResult> (ClaimsPrincipal p, AppDbContext db, CancellationToken ct) =>
        {
            var uid = Uid(p);
            var t = await db.Technicians.FirstOrDefaultAsync(x => x.UserId == uid, ct);
            if (t is null) return Results.NotFound();
            var count = await db.JobRatings.CountAsync(x => x.TechnicianId == t.Id, ct);
            var avg = await db.JobRatings.Where(x => x.TechnicianId == t.Id).AverageAsync(x => (double?)x.Stars, ct);
            var recent = await (from x in db.JobRatings join j in db.Jobs on x.JobId equals j.Id join c in db.Companies on x.CompanyId equals c.Id
                                where x.TechnicianId == t.Id orderby x.CreatedAt descending
                                select new { x.Stars, x.Comment, x.CreatedAt, jobReference = j.Reference, company = c.DisplayName }).Take(20).ToListAsync(ct);
            return Results.Ok(new { count, average = avg == null ? (double?)null : Math.Round(avg.Value, 2), recent });
        });

        // ======== Email / phone verification ========
        api.MapPost("/me/verify/email/request", async Task<IResult> (ClaimsPrincipal p, AppDbContext db, IVerificationDelivery delivery, HttpContext http, CancellationToken ct) =>
        {
            var uid = Uid(p);
            var u = await db.Users.FirstAsync(x => x.Id == uid, ct);
            if (u.EmailVerifiedAt is not null) return Results.Conflict(new { error = "Email is already verified." });
            return await RequestCode("email", u.Email, uid, db, delivery, http, ct);
        });

        api.MapPost("/me/verify/email/confirm", async Task<IResult> (VerifyConfirmReq r, ClaimsPrincipal p, AppDbContext db, HttpContext http, CancellationToken ct) =>
        {
            var uid = Uid(p);
            var u = await db.Users.FirstAsync(x => x.Id == uid, ct);
            var (ok, error) = await CheckCode("email", u.Email, uid, r.Code, db, ct);
            if (!ok) return Bad(error!);
            u.EmailVerifiedAt = DateTime.UtcNow;
            db.Audit(http, uid, "user.email_verified", "user", uid.ToString());
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        api.MapPost("/me/verify/phone/request", async Task<IResult> (ClaimsPrincipal p, AppDbContext db, IVerificationDelivery delivery, HttpContext http, CancellationToken ct) =>
        {
            var uid = Uid(p);
            var t = await db.Technicians.FirstOrDefaultAsync(x => x.UserId == uid, ct);
            if (t is null) return Results.NotFound();
            if (t.PhoneVerifiedAt is not null) return Results.Conflict(new { error = "Phone is already verified." });
            return await RequestCode("phone", t.Phone, uid, db, delivery, http, ct);
        });

        api.MapPost("/me/verify/phone/confirm", async Task<IResult> (VerifyConfirmReq r, ClaimsPrincipal p, AppDbContext db, HttpContext http, CancellationToken ct) =>
        {
            var uid = Uid(p);
            var t = await db.Technicians.FirstOrDefaultAsync(x => x.UserId == uid, ct);
            if (t is null) return Results.NotFound();
            var (ok, error) = await CheckCode("phone", t.Phone?.Trim() ?? "", uid, r.Code, db, ct);
            if (!ok) return Bad(error!);
            t.PhoneVerifiedAt = DateTime.UtcNow;
            db.Audit(http, uid, "technician.phone_verified", "technician", t.Id.ToString());
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
