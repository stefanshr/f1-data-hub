import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnInit,
  ViewChild
} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { LapData } from "./models/lap-data.model";
import { ApexOptions } from "ng-apexcharts";
import { animate, state, style, transition, trigger } from "@angular/animations";
import { Driver } from "./models/driver.model";
import { TrackMap } from "./models/track-map.model";
import { LapDataDetail } from "./models/lap-data-detail.model";
import { forkJoin } from "rxjs";
import { F1DataService } from "../../core/services/f1-data.service";
import { TrackMapComponent } from "./components/track-map/track-map.component";

@Component({
  selector: 'app-lap-comparison',
  templateUrl: './lap-comparison.component.html',
  styleUrls: ['./lap-comparison.component.scss'],
  animations: [
    trigger('slideInOut', [
      state('in', style({transform: 'translateX(0%)'})),
      transition(':enter', [
        style({transform: 'translateX(+100%)'}),
        animate('600ms ease-in')
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({transform: 'translateX(100%)'}))
      ])
    ]),
  ]
})
export class LapComparisonComponent implements OnInit, AfterViewInit {
  @ViewChild(TrackMapComponent) trackMapComponent!: TrackMapComponent;

  // ----- Form Variables -----
  comparisonForm!: FormGroup;
  activeIndex = 0;
  previousValues: any = {};
  stepToFormControlName = ['year', 'venue', 'sessionType', 'firstDriver', 'secondDriver'];
  compFormStepper = [
    {label: 'Select Year', active: true},
    {label: 'Select Venue', active: false},
    {label: 'Select Session', active: false},
    {label: 'Select First Driver', active: false},
    {label: 'Select Second Driver', active: false},
  ];

  // ----- Data Variables -----
  years: number[] = [];
  venues: string[] = [];
  drivers: Driver[] = [];
  laps: LapData[] = [];
  displayedLaps: LapData[] = [];
  sessionTypes: string[] = [];
  filteredVenues: string[] = [];
  filteredYears: number[] = [];
  filteredDrivers: Driver[] = [];
  showInvalidLaps: boolean = false;
  showOutliers: boolean = false;
  firstDriverLap: LapData | null = null;
  secondDriverLap: LapData | null = null;

  firstDriverLapData: LapDataDetail | null = null;
  secondDriverLapData: LapDataDetail | null = null;

  showFormFields: boolean = false;
  trackMapData: TrackMap = {track: [], corners: []};

  initialTopPosition: number = 0;
  readonly SCROLL_THRESHOLD = 75;

  lapChartOptions: Partial<ApexOptions> = {};
  comparisonChartCommonOptions: Partial<ApexOptions> = {};

  // ----- Constructor and Initialization -----
  constructor(private f1DataService: F1DataService,
              private fb: FormBuilder,
              private cd: ChangeDetectorRef,
              private el: ElementRef) {
    this.initializeForm();
    this.setupFormListeners();
  }

  ngOnInit() {
    this.initializeData();
  }

  initializeData() {
    this.initializeYears();
    // this.setDefaultFormValues();
    this.initializeCharts();
  }

  ngAfterViewInit() {
    const trackMapElement = this.el.nativeElement.querySelector('#track-map-container');
    this.initialTopPosition = trackMapElement.getBoundingClientRect().top + window.pageYOffset;
    this.showFormFields = true;
  }

  @HostListener('window:scroll', ['$event'])
  onWindowScroll() {
    this.checkScroll();
  }

  checkScroll() {
    const trackMapElement = this.el.nativeElement.querySelector('#track-map-container');
    const scrolledDistance = window.pageYOffset;
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    const rect = trackMapElement.getBoundingClientRect();
    const distanceToLeft = (windowWidth - rect.width) / 2;
    const aniDistTraveled = this.SCROLL_THRESHOLD - (this.initialTopPosition - scrolledDistance);
    const moveElement = (aniDistTraveled / 75) * distanceToLeft

    if (this.initialTopPosition - scrolledDistance > -this.SCROLL_THRESHOLD && this.initialTopPosition - scrolledDistance <= 0) {
      trackMapElement.style.left = `-${distanceToLeft}px`;
      trackMapElement.style.top = `0px`;
    } else if (this.initialTopPosition - scrolledDistance < this.SCROLL_THRESHOLD) {
      if (moveElement <= distanceToLeft) {
        trackMapElement.style.left = `-${moveElement}px`;
      } else {
        trackMapElement.style.left = `-${distanceToLeft}px`;
        const centerPosition = ((windowHeight - rect.height) / 2) - (this.initialTopPosition - scrolledDistance);
        trackMapElement.style.top = `${centerPosition}px`;

        trackMapElement.style.verticalAlign = 'middle';
      }
    } else if (scrolledDistance < this.initialTopPosition - this.SCROLL_THRESHOLD) {
      trackMapElement.style.left = '0px';
      trackMapElement.style.position = 'relative';
      trackMapElement.style.top = '0px';
    }
  }

  initializeForm() {
    this.comparisonForm = this.fb.group({
      year: ['', Validators.required],
      venue: ['', Validators.required],
      sessionType: ['', Validators.required],
      firstDriver: ['', Validators.required],
      secondDriver: ['', Validators.required]
    });
  }

  initializeYears() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= 2018; i--) {
      this.years.push(i);
    }
  }

  initializeCharts() {
    this.lapChartOptions = {
      chart: {
        foreColor: 'var(--text-color)',
        type: "line",
        toolbar: {
          tools: {
            download: false,
          }
        },
        height: 400,
        events: {
          markerClick: (event, chartContext, config) => {
            this.selectLap(config.dataPointIndex)
          }
        },
        animations: {
          enabled: true,
          easing: 'easeout',
        }
      },
      xaxis: {
        categories: [],
        crosshairs: {
          show: false
        },
        labels: {
          style: {
            colors: 'var(--text-color)'
          }
        }
      },
      yaxis: {
        labels: {
          style: {
            colors: 'var(--text-color)'
          },
          formatter: (val: number) => this.formatTime(val)
        }
      },
      tooltip: {
        y: {
          formatter: (val: number) => this.formatTime(val)
        },
        shared: true,
        intersect: false,
        theme: 'dark',
        marker: {
          show: false
        },

      },
      stroke: {
        curve: "smooth",
        width: 2,
        colors: ['#FFFFFF'],
      },
      grid: {
        xaxis: {
          lines: {
            show: true
          }
        },
        yaxis: {
          lines: {
            show: true
          }
        },
        strokeDashArray: 5,
      },
      markers: {
        size: 5,
        shape: "circle",
        strokeColors: '#000000',
        strokeWidth: 1,
        colors: ['#FFFFFF'],
      },

    };
    this.comparisonChartCommonOptions = {}
  }

  setDefaultFormValues() {

    const driver1: Driver = {
      driverNumber: '44',
      lastName: 'Hamilton',
      firstName: 'Lewis',
      headshotUrl: 'url_to_headshot',
      abbreviation: 'HAM',
      countryCode: 'GB',
      teamName: 'Mercedes',
      teamColor: '#320232'
    };

    const driver2: Driver = {
      driverNumber: '63',
      lastName: 'Russel',
      firstName: 'George',
      headshotUrl: 'url_to_headshot',
      abbreviation: 'RUS',
      countryCode: 'GB',
      teamName: 'Mercedes',
      teamColor: '#ef21ef'
    };

    this.comparisonForm.setValue({
      year: '2023',
      venue: 'Qatar Grand Prix',
      sessionType: 'Sprint',
      firstDriver: driver1,
      secondDriver: driver2
    });
    this.onYearChange();
    this.onVenueChange();
    this.onSessionChange();
    this.onDriverChange(driver1, false, false);

    const firstLap: LapData = {
      lapNumber: 16,
      lapTime: '88.731',
      deleted: false,
      compound: 'MEDIUM',
      tyreLife: 2,
    }

    const secondLap: LapData = {
      lapNumber: 16,
      lapTime: '88.687',
      deleted: false,
      compound: 'SOFT',
      tyreLife: 2,
    }

    this.firstDriverLap = firstLap;
    this.secondDriverLap = secondLap;

    this.activeIndex = 4;

    const clickEvent: Event = new Event('click');
    this.compare(clickEvent);
  }

  setupFormListeners() {
    this.comparisonForm.get('year')?.valueChanges.subscribe((newValue) => {
      if (newValue !== this.previousValues['year'] && newValue !== null) {
        this.resetFormFieldsAfter('year');
        this.fetchVenues();
      }
    });
    this.comparisonForm.get('venue')?.valueChanges.subscribe((newValue) => {
      if (newValue !== this.previousValues['venue'] && newValue !== null) {
        this.resetFormFieldsAfter('venue');
        this.fetchSessions();
      }
    });
    this.comparisonForm.get('sessionType')?.valueChanges.subscribe((newValue) => {
      if (newValue !== this.previousValues['sessionType'] && newValue !== null) {
        this.resetFormFieldsAfter('sessionType');
        this.fetchDrivers();
      }
    });
  }

  resetFormFieldsAfter(fieldName: string) {
    const index = this.stepToFormControlName.indexOf(fieldName);
    this.comparisonForm.get(this.stepToFormControlName[index + 1])?.reset();
    this.firstDriverLap = null;
    this.secondDriverLap = null;
  }

  fetchVenues() {
    const year = this.getYearValue();
    this.f1DataService.getRacingVenues(year).subscribe(venues => {
      this.venues = venues;
    });
  }

  fetchSessions() {
    const year = this.getYearValue();
    const venue = this.getVenueValue();
    this.f1DataService.getSessionsFromVenue(year, venue).subscribe(sessions => {
      this.sessionTypes = sessions;
    });
  }

  fetchDrivers() {
    const {year, venue, sessionType} = this.comparisonForm.value;
    this.f1DataService.getDriversFromVenue(year, venue, sessionType).subscribe(drivers => {
      this.drivers = drivers.sort((a, b) => parseInt(a.driverNumber) - parseInt(b.driverNumber));
    });
  }

// ----- Form Handling Functions -----
  onYearChange() {
    this.fetchVenues();
    this.nextStep();
  }

  onVenueChange() {
    this.fetchSessions();
    this.nextStep();
  }

  onSessionChange() {
    this.fetchDrivers();
    this.nextStep();
  }

  onDriverChange(driver: Driver, isSecondDriver: boolean, leaveLapData: boolean) {
    this.loadLapData(driver, leaveLapData, lap => {
      if (isSecondDriver) {
        this.secondDriverLap = lap;
      } else {
        this.firstDriverLap = lap;
      }
    });
  }

// Form navigation
  nextStep() {
    if (this.activeIndex === this.compFormStepper.length - 1) return;

    const currentControlName = this.getFormControlNameByStep(this.activeIndex);

    if (this.comparisonForm.get(currentControlName)?.valid) {
      this.saveState(this.activeIndex);
      this.activeIndex++;
      this.performSideEffectForStep(this.activeIndex);
    }
  }

  prevStep() {
    if (this.activeIndex === 0) return;

    this.saveState(this.activeIndex);
    this.activeIndex--;
    this.performSideEffectForStep(this.activeIndex);
  }

  saveState(step: number) {
    const controlName = this.stepToFormControlName[step];
    this.previousValues[controlName] = this.comparisonForm.get(controlName)?.value;
  }


  performSideEffectForStep(step: number) {
    switch (step) {
      case 3:
        if (this.getFirstDriverValue()) {
          this.onDriverChange(this.getFirstDriverValue(), false, true);
        } else {
          this.laps = [];
        }
        break;
      case 4:
        if (this.getSecondDriverValue()) {
          this.onDriverChange(this.getSecondDriverValue(), true, true);
        } else {
          this.laps = [];
        }
        break;
      default:
        break;
    }
  }

  isCurrentStepInvalid() {
    const valid = this.comparisonForm.get(this.getFormControlNameByStep(this.activeIndex))?.valid
    return !valid;
  }

  getFormControlNameByStep(stepIndex: number): string {
    return this.stepToFormControlName[stepIndex] || '';
  }

// ----- Filter Functions -----
  filterVenues(event: any) {
    const query = event.query;
    this.filteredVenues = this.venues.filter(venue => venue.toLowerCase().includes(query.toLowerCase()));
  }

  filterYears(event: any) {
    const query = event.query;
    this.filteredYears = this.years.filter(year => year.toString().includes(query));
  }

  filterDrivers(event: any) {
    const query = event.query.toLowerCase();
    this.filteredDrivers = this.drivers.filter(driver =>
      (driver.firstName.toLowerCase() + driver.lastName.toLowerCase() + driver.driverNumber).includes(query)
    );
  }


// ----- Utility Functions -----

  formatDriverDisplay(driver: Driver): string {
    return `${driver.driverNumber} - ${driver.firstName} ${driver.lastName}`;
  }

  formatTime(value: number | string): string {
    const totalSeconds = parseFloat(value.toString());
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = ((totalSeconds % 1) * 1000).toFixed(0);
    return `${minutes}:${seconds}.${milliseconds}`;
  }

  removeInvalidLaps(laps: LapData[]): LapData[] {
    return laps.filter(lap => lap.lapTime !== 'NaT');
  }

  removeOutliers(laps: LapData[]): LapData[] {
    const lapTimes = laps.map(lap => parseFloat(lap.lapTime)).filter(time => !isNaN(time));

    const sortedLaps = lapTimes.slice().sort((a, b) => a - b);
    const mid = Math.ceil(sortedLaps.length / 2);
    const median = sortedLaps.length % 2 === 0 ? (sortedLaps[mid] + sortedLaps[mid - 1]) / 2 : sortedLaps[mid - 1];

    const threshold = median * 1.06;

    return laps.filter(lap => {
      const lapTime = parseFloat(lap.lapTime);
      return isNaN(lapTime) || lapTime < threshold;
    });
  }

  loadLapData(driver: Driver, leaveLapData: boolean, setLap: (lap: LapData | null) => void) {
    const {year, venue, sessionType} = this.comparisonForm.value;
    const driverNumber = parseInt(driver.driverNumber);

    this.showOutliers = false;
    this.showInvalidLaps = false;

    if (!leaveLapData) {
      setLap(null)
    }

    this.f1DataService.getLapsFromDriverNumber(year, venue, sessionType, driverNumber).subscribe(laps => {
      this.laps = laps;
      this.displayedLaps = this.removeInvalidLaps(this.laps);
      this.displayedLaps = this.removeOutliers(this.displayedLaps);
      this.updateChart(this.displayedLaps);
    });
  }

  getYearValue(): number {
    return this.comparisonForm.get('year')?.value;
  }

  getVenueValue(): string {
    return this.comparisonForm.get('venue')?.value;
  }

  getSessionTypeValue(): string {
    return this.comparisonForm.get('sessionType')?.value;
  }

  getFirstDriverValue(): Driver {
    return this.comparisonForm.get('firstDriver')?.value;
  }

  getSecondDriverValue(): Driver {
    return this.comparisonForm.get('secondDriver')?.value;
  }


//   ----- Chart Functions -----
  updateChart(data: LapData[]) {
    const customDataSeries = data.map(lap => ({
      x: lap.lapNumber,
      y: lap.lapTime === 'NaT' ? 0 : parseFloat(lap.lapTime)
    }));

    const newSeriesData = [{
      name: "Lap Time",
      data: customDataSeries
    }];

    const maxLapNumber = Math.max(...this.laps.map(lap => lap.lapNumber));

    this.lapChartOptions = {
      ...this.lapChartOptions,
      xaxis: {
        type: 'numeric',
        min: 1,
        max: maxLapNumber,
        tickPlacement: 'on',
      },
      series: newSeriesData
    };
  }


  toggleInvalidLaps() {
    if (this.showInvalidLaps) {
      this.showInvalidLaps = false;
      this.displayedLaps = this.displayedLaps.filter(lap => lap.lapTime !== 'NaT');
    } else {
      this.showInvalidLaps = true;
      this.displayedLaps.push(...this.laps.filter(lap => lap.lapTime === 'NaT'));

    }

    this.displayedLaps.sort((a, b) => a.lapNumber - b.lapNumber);
    this.updateChart(this.displayedLaps);
  }

  toggleOutliers() {
    if (this.showOutliers) {
      this.showOutliers = false;
      this.displayedLaps = this.removeOutliers(this.displayedLaps);
    } else {
      this.showOutliers = true;
      if (this.showInvalidLaps) {
        this.displayedLaps = this.laps
      } else {
        this.displayedLaps = this.removeInvalidLaps(this.laps);
      }
    }

    this.displayedLaps.sort((a, b) => a.lapNumber - b.lapNumber);
    this.updateChart(this.displayedLaps);
  }

  selectLap(index: number) {
    if (this.activeIndex === 3) {
      this.firstDriverLap = this.displayedLaps[index];
    } else {
      this.secondDriverLap = this.displayedLaps[index];
    }
    this.cd.detectChanges();
  }

  isComparisonPossible() {
    return !!(this.firstDriverLap?.lapNumber && this.secondDriverLap?.lapNumber);
  }

  compare(event: Event) {
    event.stopPropagation();
    this.showFormFields = false;
    const year = this.getYearValue();
    const venue = this.getVenueValue();
    const sessionType = this.getSessionTypeValue();
    const firstDriver = this.getFirstDriverValue();
    const secondDriver = this.getSecondDriverValue();

    this.f1DataService.getTrackMap(year, venue, sessionType).subscribe(trackMap => {
      this.trackMapData = trackMap;
      this.trackMapComponent.drawTrackMap(this.trackMapData)

      const firstDriverLapData$ = this.f1DataService.getDriverLapData(year, venue, sessionType, parseInt(firstDriver.driverNumber), this.firstDriverLap!.lapNumber);
      const secondDriverLapData$ = this.f1DataService.getDriverLapData(year, venue, sessionType, parseInt(secondDriver.driverNumber), this.secondDriverLap!.lapNumber);

      forkJoin([firstDriverLapData$, secondDriverLapData$]).subscribe(results => {
        this.firstDriverLapData = results[0];
        this.secondDriverLapData = results[1];

        this.trackMapComponent.drawDominanceMap(this.firstDriverLapData, this.secondDriverLapData, year, venue, sessionType);
      });
    });
  }

  handleStepperClick() {
    if (!this.showFormFields) {
      this.showFormFields = true;
    } else if (this.showFormFields && this.firstDriverLapData && this.secondDriverLapData) {
      this.showFormFields = false;
    }
  }
}
