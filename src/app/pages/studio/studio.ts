import { Component } from '@angular/core';

interface Study {
  id: string;
  title: string;
  text: string;
  shape: string;
}

@Component({
  selector: 'app-studio',
  templateUrl: './studio.html',
})
export class Studio {
  protected readonly studies: readonly Study[] = [
    {
      id: 'profil',
      title: 'Profil',
      text: 'Prawa strona znaku: zwarta sylwetka, bez siatki.',
      shape: 'shape shape--profile',
    },
    {
      id: 'luk',
      title: 'Łuk',
      text: 'Portal za głową. W aplikacji otwiera się dopiero po sesji.',
      shape: 'shape shape--arch',
    },
    {
      id: 'siatka',
      title: 'Siatka',
      text: 'Lewa strona znaku: płaszczyzny, które składają twarz.',
      shape: 'shape shape--mesh',
    },
  ];
}
