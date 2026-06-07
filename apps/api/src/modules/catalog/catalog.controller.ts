import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Public } from '../../common/auth/public.decorator';

@ApiTags('catalog')
@Controller('categories')
export class CatalogController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista as áreas/categorias jurídicas (público).' })
  async list() {
    const categories = await this.prisma.category.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      include: { subcategories: { where: { active: true }, orderBy: { name: 'asc' } } },
    });
    return {
      data: categories.map((c) => ({
        slug: c.slug,
        name: c.name,
        subcategories: c.subcategories.map((s) => ({ slug: s.slug, name: s.name })),
      })),
    };
  }
}
