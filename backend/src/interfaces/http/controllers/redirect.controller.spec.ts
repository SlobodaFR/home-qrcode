import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RedirectUseCase } from '../../../application/redirect/redirect.use-case';
import { RedirectController } from './redirect.controller';

const makeController = async () => {
  const module = await Test.createTestingModule({
    controllers: [RedirectController],
    providers: [
      { provide: RedirectUseCase, useValue: { execute: jest.fn().mockResolvedValue({ targetUrl: 'https://target.com' }) } },
    ],
  }).compile();
  return {
    controller: module.get(RedirectController),
    useCase: module.get<jest.Mocked<RedirectUseCase>>(RedirectUseCase),
  };
};

describe('RedirectController', () => {
  // Test 25 — TPP: constant
  it('should return redirect object with url and statusCode 302', async () => {
    const { controller } = await makeController();
    const result = await controller.redirect('qr-1');
    expect(result).toEqual({ url: 'https://target.com', statusCode: 302 });
  });

  // Test 26 — TPP: constant
  it('should have @Public() (route accessible without auth)', async () => {
    const metadata: unknown = Reflect.getMetadata('isPublic', RedirectController.prototype.redirect);
    expect(metadata).toBe(true);
  });

  // Test 27 — TPP: conditional
  it('should propagate NotFoundException from use case as 404', async () => {
    const { controller, useCase } = await makeController();
    (useCase.execute as jest.Mock).mockRejectedValue(new NotFoundException());
    await expect(controller.redirect('missing')).rejects.toThrow(NotFoundException);
  });
});
