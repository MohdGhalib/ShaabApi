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
    }
}
