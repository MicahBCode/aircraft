import {
  FSComponent,
  EventBus,
  HEventPublisher,
  InstrumentBackplane,
  FsInstrument,
  FsBaseInstrument,
  ClockPublisher,
} from '@microsoft/msfs-sdk';
import { FmcService } from 'instruments/src/MFD/FMC/FmcService';
import { FmcServiceInterface } from 'instruments/src/MFD/FMC/FmcServiceInterface';
import { MfdComponent } from './MFD';
import { MfdSimvarPublisher } from './shared/MFDSimvarPublisher';
import { FailuresConsumer } from '@flybywiresim/fbw-sdk';
import { A380Failure } from '@failures';

class MfdInstrument implements FsInstrument {
  private readonly bus = new EventBus();

  private readonly backplane = new InstrumentBackplane();

  private readonly simVarPublisher: MfdSimvarPublisher;

  private readonly clockPublisher = new ClockPublisher(this.bus);

  private readonly hEventPublisher = new HEventPublisher(this.bus);

  private mfdCaptRef = FSComponent.createRef<MfdComponent>();

  private mfdFoRef = FSComponent.createRef<MfdComponent>();

  private readonly fmcService: FmcServiceInterface;

  private readonly failuresConsumer = new FailuresConsumer('A32NX');

  constructor(public readonly instrument: BaseInstrument) {
    this.simVarPublisher = new MfdSimvarPublisher(this.bus);
    this.hEventPublisher = new HEventPublisher(this.bus);

    this.backplane.addPublisher('mfd', this.simVarPublisher);
    this.backplane.addPublisher('hEvent', this.hEventPublisher);
    this.backplane.addPublisher('clock', this.clockPublisher);

    this.fmcService = new FmcService(this.bus, this.mfdCaptRef.getOrDefault(), this.failuresConsumer);

    this.doInit();
  }

  public doInit(): void {
    this.backplane.init();

    const mfd = document.getElementById('MFD_CONTENT');
    if (mfd) {
      mfd.style.display = 'flex';
      mfd.style.flexDirection = 'row';
      mfd.style.height = '1024';
    }

    FSComponent.render(
      <div id="MFD_LEFT_PARENT_DIV" style="width: 768px; position: relative; margin-right: 110px;" />,
      document.getElementById('MFD_CONTENT'),
    );
    FSComponent.render(
      <div id="MFD_RIGHT_PARENT_DIV" style="width: 768px; position: relative;" />,
      document.getElementById('MFD_CONTENT'),
    );
    FSComponent.render(
      <MfdComponent captOrFo="CAPT" ref={this.mfdCaptRef} bus={this.bus} fmcService={this.fmcService} />,
      document.getElementById('MFD_LEFT_PARENT_DIV'),
    );
    FSComponent.render(
      <MfdComponent captOrFo="FO" ref={this.mfdFoRef} bus={this.bus} fmcService={this.fmcService} />,
      document.getElementById('MFD_RIGHT_PARENT_DIV'),
    );

    // Update MFD reference for deduplication etc.
    if (this.fmcService.master) {
      this.fmcService.master.mfdReference = this.mfdCaptRef.instance;
    }

    // Navigate to initial page
    this.mfdCaptRef.instance.uiService.navigateTo('fms/data/status');
    this.mfdFoRef.instance.uiService.navigateTo('fms/data/status');

    // Remove "instrument didn't load" text
    mfd?.querySelector(':scope > h1')?.remove();

    this.failuresConsumer.register(A380Failure.FmcA);
    this.failuresConsumer.register(A380Failure.FmcB);
    this.failuresConsumer.register(A380Failure.FmcC);
  }

  /**
   * A callback called when the instrument gets a frame update.
   */
  public Update(): void {
    this.backplane.onUpdate();
    this.failuresConsumer.update();
  }

  public onInteractionEvent(args: string[]): void {
    this.hEventPublisher.dispatchHEvent(args[0]);
  }

  public onGameStateChanged(_oldState: GameState, _newState: GameState): void {
    // noop
  }

  public onFlightStart(): void {
    // noop
  }

  public onSoundEnd(_soundEventId: Name_Z): void {
    // noop
  }

  public onPowerOn(): void {
    // noop
  }

  public onPowerOff(): void {
    // noop
  }
}

class A380X_MFD extends FsBaseInstrument<MfdInstrument> {
  public constructInstrument(): MfdInstrument {
    return new MfdInstrument(this);
  }

  public get isInteractive(): boolean {
    return true;
  }

  public get templateID(): string {
    return 'A380X_MFD';
  }

  /** @inheritdoc */
  public onPowerOn(): void {
    super.onPowerOn();

    this.fsInstrument.onPowerOn();
  }

  /** @inheritdoc */
  public onShutDown(): void {
    super.onShutDown();

    this.fsInstrument.onPowerOff();
  }
}

registerInstrument('a380x-mfd', A380X_MFD);