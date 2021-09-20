import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { AuthGuard } from 'src/app/core/guards/auth.guard';
import { LayoutComponent } from 'src/app/layouts/layout/layout.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'scheduled',
    pathMatch: 'full'
  },
  {
    path: 'scheduled',
    component: LayoutComponent, 
    loadChildren: () => import('./pages/scheduled/scheduled.module').then(m => m.ScheduledPageModule),
    canActivate: [ AuthGuard ]
  },
  {
    path: 'edit-call/:id/:source',
    component: LayoutComponent, 
    loadChildren: () => import('./pages/edit-call/edit-call.module').then(m => m.EditCallPageModule),
    canActivate: [ AuthGuard ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CallsRoutingModule {}
