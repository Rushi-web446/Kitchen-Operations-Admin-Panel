import {
  Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CategoryDto, DishDto, ListCatalogueDto, MenuPreviewQueryDto, OptionDto,
  OptionGroupDto, ReferenceNameDto,
} from './dto/catalogue.dto';
import { CatalogueService } from './catalogue.service';

@Controller('catalogue')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class CatalogueController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get('reference-data')
  referenceData() {
    return this.catalogue.referenceData();
  }

  @Post('reference-data/allergens')
  createAllergen(@Body() dto: ReferenceNameDto) {
    return this.catalogue.createReference('allergens', dto);
  }

  @Post('reference-data/dietary-tags')
  createDietaryTag(@Body() dto: ReferenceNameDto) {
    return this.catalogue.createReference('dietary-tags', dto);
  }

  @Get('categories')
  listCategories() {
    return this.catalogue.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CategoryDto) {
    return this.catalogue.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id', ParseIntPipe) id: number, @Body() dto: CategoryDto) {
    return this.catalogue.updateCategory(id, dto);
  }

  @Get('dishes')
  listDishes(@Query() query: ListCatalogueDto) {
    return this.catalogue.listDishes(query);
  }

  @Get('dishes/:id')
  getDish(@Param('id', ParseIntPipe) id: number) {
    return this.catalogue.getDish(id);
  }

  @Post('dishes')
  createDish(@Body() dto: DishDto) {
    return this.catalogue.createDish(dto);
  }

  @Patch('dishes/:id')
  updateDish(@Param('id', ParseIntPipe) id: number, @Body() dto: DishDto) {
    return this.catalogue.updateDish(id, dto);
  }

  @Get('options')
  listOptions() {
    return this.catalogue.listOptions();
  }

  @Post('options')
  createOption(@Body() dto: OptionDto) {
    return this.catalogue.createOption(dto);
  }

  @Patch('options/:id')
  updateOption(@Param('id', ParseIntPipe) id: number, @Body() dto: OptionDto) {
    return this.catalogue.updateOption(id, dto);
  }

  @Get('option-groups')
  listOptionGroups() {
    return this.catalogue.listOptionGroups();
  }

  @Post('option-groups')
  createOptionGroup(@Body() dto: OptionGroupDto) {
    return this.catalogue.createOptionGroup(dto);
  }

  @Patch('option-groups/:id')
  updateOptionGroup(@Param('id', ParseIntPipe) id: number, @Body() dto: OptionGroupDto) {
    return this.catalogue.updateOptionGroup(id, dto);
  }

  @Get('menu/preview')
  previewMenu(@Query() query: MenuPreviewQueryDto) {
    return this.catalogue.previewMenu(query);
  }
}
