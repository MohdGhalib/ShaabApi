using Microsoft.EntityFrameworkCore;
using ShaabApi.Models;

namespace ShaabApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<StorageEntry> Storage     => Set<StorageEntry>();
    public DbSet<Inquiry>      Inquiries   => Set<Inquiry>();
    public DbSet<Montasia>     Montasiat   => Set<Montasia>();
    public DbSet<Complaint>    Complaints  => Set<Complaint>();
    public DbSet<FileBlob>     Files       => Set<FileBlob>();
    public DbSet<AuditEntry>   AuditLog    => Set<AuditEntry>();
    public DbSet<Employee>     Employees   => Set<Employee>();
    public DbSet<Message>      Messages    => Set<Message>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<StorageEntry>(entity =>
        {
            entity.Property(e => e.UpdatedAt)
                  .ValueGeneratedOnAddOrUpdate()
                  .HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        modelBuilder.Entity<Inquiry>(entity =>
        {
            entity.Property(e => e.Version).IsConcurrencyToken();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(e => e.Branch);
            entity.HasIndex(e => e.Iso);
            entity.HasIndex(e => e.Phone);
        });

        modelBuilder.Entity<Montasia>(entity =>
        {
            entity.Property(e => e.Version).IsConcurrencyToken();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(e => e.Branch);
            entity.HasIndex(e => e.Iso);
            entity.HasIndex(e => e.Type);
        });

        modelBuilder.Entity<Complaint>(entity =>
        {
            entity.Property(e => e.Version).IsConcurrencyToken();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(e => e.Branch);
            entity.HasIndex(e => e.Iso);
        });

        modelBuilder.Entity<FileBlob>(entity =>
        {
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(e => new { e.RefType, e.RefId });
        });

        modelBuilder.Entity<AuditEntry>(entity =>
        {
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(e => e.Ts);
            entity.HasIndex(e => e.EmpId);
        });

        modelBuilder.Entity<Employee>(entity =>
        {
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
        });

        modelBuilder.Entity<Message>(entity =>
        {
            entity.Property(e => e.Version).IsConcurrencyToken();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("CURRENT_TIMESTAMP");
            entity.HasIndex(e => e.Ts);
            entity.HasIndex(e => e.ToName);
            entity.HasIndex(e => e.FromName);
        });
    }
}
