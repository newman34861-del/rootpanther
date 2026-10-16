import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PathController } from "./path.controller";
import { PathService } from "./path.service";

@Module({
  imports: [AuthModule],
  controllers: [PathController],
  providers: [PathService],
})
export class PathModule {}
