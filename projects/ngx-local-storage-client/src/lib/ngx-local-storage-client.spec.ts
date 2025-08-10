import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxLocalStorageClient } from './ngx-local-storage-client';

describe('NgxLocalStorageClient', () => {
  let component: NgxLocalStorageClient;
  let fixture: ComponentFixture<NgxLocalStorageClient>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgxLocalStorageClient]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgxLocalStorageClient);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
