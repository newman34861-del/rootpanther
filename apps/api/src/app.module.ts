import { Module } from "@nestjs/common";
import { ConfigModule } from "./config/config.module";
import { DbModule } from "./db/db.module";
import { AccountModule } from "./modules/account/account.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CatalogueModule } from "./modules/catalogue/catalogue.module";
import { PathModule } from "./modules/path/path.module";
import { HealthController } from "./modules/health/health.controller";

@Module({
  imports: [ConfigModule, DbModule, AuthModule, AccountModule, CatalogueModule, PathModule],
  controllers: [HealthController],
})
export class AppModule {}
