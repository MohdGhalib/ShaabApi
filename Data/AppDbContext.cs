using Microsoft.EntityFrameworkCore;
using ShaabApi.Models;

namespace ShaabApi.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<StorageEntry> Storage => Set<StorageEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<StorageEntry>(entity =>
        {
            entity.Property(e => e.UpdatedAt)
                  .ValueGeneratedOnAddOrUpdate()
                  .HasDefaultValueSql("CURRENT_TIMESTAMP");
        });
    }
}
