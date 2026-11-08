using Duale.Api.Domain;
namespace Duale.Api.Data;

public static class Seed
{
    public static readonly string[] Permissions =
    [
        "company.read", "company.manage", "staff.manage", "company.verify", "technician.verify", "catalog.manage", "audit.read",
        "relationship.read", "relationship.manage", "customer.manage", "job.read", "job.manage", "job.dispatch",
        "branch.manage", "user.support", "job.review",
        "finance.read", "finance.terms", "finance.terms.approve", "finance.invoice", "finance.payment", "finance.reconcile",
        "finance.refund.request", "finance.refund.approve", "finance.adjust", "report.read", "platform.finance", "platform.oversight", "integration.manage"
    ];

    // Role code -> (scope, permissions). A starting point; confirm assignments with the business.
    public static readonly Dictionary<string, (string Scope, string[] Perms)> Roles = new()
    {
        ["platform_admin"] = ("platform", ["company.verify", "technician.verify", "catalog.manage", "user.support", "platform.oversight", "integration.manage"]),
        ["platform_finance"] = ("platform", ["platform.finance", "platform.oversight"]),
        ["verification_officer"] = ("platform", ["company.verify", "technician.verify"]),
        ["company_owner"] = ("company", ["company.read", "company.manage", "staff.manage", "audit.read", "relationship.read", "relationship.manage", "customer.manage", "job.read", "job.manage", "job.dispatch", "branch.manage", "job.review",
            "finance.read", "finance.terms", "finance.terms.approve", "finance.invoice", "finance.payment", "finance.reconcile", "finance.refund.request", "finance.refund.approve", "finance.adjust", "report.read"]),
        ["dispatcher"] = ("company", ["company.read", "relationship.read", "customer.manage", "job.read", "job.manage", "job.dispatch", "finance.terms", "report.read"]),
        ["supervisor"] = ("company", ["company.read", "relationship.read", "job.read", "job.review", "report.read"]),
        ["company_finance"] = ("company", ["company.read", "job.read", "finance.read", "finance.invoice", "finance.payment", "finance.reconcile", "finance.refund.request", "report.read"]),
        ["auditor"] = ("company", ["company.read", "audit.read", "relationship.read", "job.read", "finance.read", "report.read"]),
    };

    public static string[] CompanyRoles => Roles.Where(r => r.Value.Scope == "company").Select(r => r.Key).ToArray();

    // Trade names come from the spec; qualifications per trade are a business decision and are NOT seeded.
    static readonly string[] TradeNames =
        ["Furniture assembly", "Plumbing", "Electrical work", "Masonry", "Painting", "Tiling", "Carpentry", "Fittings", "Maintenance"];

    public static IEnumerable<Trade> Trades() =>
        TradeNames.Select((n, i) => new Trade { Id = new Guid(i + 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0), Name = n });
}
