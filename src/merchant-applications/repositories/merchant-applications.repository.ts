import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';
import { MerchantApplication } from '../entities/merchant-application.entity';
import { ApplicationStatus } from '../enums/merchant-application.enums';

export interface FindPaginatedFilters {
  page: number;
  limit: number;
  status?: ApplicationStatus;
  createdById?: string;
  reviewerId?: string;
}

@Injectable()
export class MerchantApplicationsRepository {
  constructor(
    @InjectRepository(MerchantApplication)
    private readonly repository: Repository<MerchantApplication>,
  ) {}

  create(data: DeepPartial<MerchantApplication>): MerchantApplication {
    return this.repository.create(data);
  }

  save(entity: MerchantApplication): Promise<MerchantApplication> {
    return this.repository.save(entity);
  }

  findById(id: string): Promise<MerchantApplication | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findPaginated(
    filters: FindPaginatedFilters,
  ): Promise<[MerchantApplication[], number]> {
    const qb = this.repository.createQueryBuilder('app');

    if (filters.createdById) {
      qb.andWhere('app.created_by_id = :createdById', {
        createdById: filters.createdById,
      });
    }

    if (filters.reviewerId) {
      qb.andWhere(
        '(app.assigned_reviewer_id = :reviewerId OR app.created_by_id = :reviewerId)',
        { reviewerId: filters.reviewerId },
      );
    }

    if (filters.status) {
      qb.andWhere('app.status = :status', { status: filters.status });
    }

    qb.orderBy('app.created_at', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    return qb.getManyAndCount();
  }
}
