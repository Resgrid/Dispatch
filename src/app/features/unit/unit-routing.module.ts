import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'unit',
    pathMatch: 'full'
  }//,
  //{
  //  path: 'unit',
  //  loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
  //}
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class UnitRoutingModule {}
