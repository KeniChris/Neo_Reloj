import sensor from '@system.sensor';

// Lectura local: sin datos simulados, red, Wear Engine ni dependencias externas.
// Solo el codigo de los callbacks del sensor puede incrementar los contadores.
var active = false;
var generation = 0;
var timer = null;
var startMs = 0;
var rateMs = 0;
var counts = [0, 0];
var previousCounts = [0, 0];
var lastMs = [0, 0];
var values = [null, null];
var errors = ['', ''];

function valid(sample) {
  return sample && typeof sample.x === 'number' && isFinite(sample.x) &&
    typeof sample.y === 'number' && isFinite(sample.y) &&
    typeof sample.z === 'number' && isFinite(sample.z);
}

function axes(sample) {
  if (!sample) { return 'X: --  Y: --  Z: --'; }
  return 'X:' + sample.x.toFixed(2) + ' Y:' + sample.y.toFixed(2) +
    ' Z:' + sample.z.toFixed(2);
}

function status(index, now) {
  if (errors[index]) { return errors[index]; }
  if (counts[index] === 0) {
    return now - startMs >= 3000 ? 'SIN DATOS' : 'ESPERANDO';
  }
  return now - lastMs[index] >= 3000 ? 'SIN ACTUALIZAR' : 'OK';
}

function unsubscribe(name) {
  try {
    if (typeof sensor[name] === 'function') { sensor[name](); }
  } catch (error) {
    console.log('[GT5_IMU] Error al cancelar ' + name + ': ' + String(error));
  }
}

function cleanup() {
  // Ignorar cualquier callback tardio de una suscripcion anterior.
  active = false;
  generation += 1;
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  unsubscribe('unsubscribeAccelerometer');
  unsubscribe('unsubscribeGyroscope');
}

function subscribe(index, name, token) {
  if (typeof sensor[name] !== 'function') {
    errors[index] = 'API NO DISPONIBLE';
    return;
  }
  try {
    sensor[name]({
      interval: 'game',
      success: function (sample) {
        if (!active || token !== generation) { return; }
        if (!valid(sample)) {
          errors[index] = 'DATOS INVALIDOS';
          return;
        }
        values[index] = { x: sample.x, y: sample.y, z: sample.z };
        counts[index] += 1;
        lastMs[index] = Date.now();
        errors[index] = '';
      },
      fail: function (message, code) {
        if (!active || token !== generation) { return; }
        errors[index] = 'ERROR ' + (code === undefined ? '?' : String(code));
        console.log('[GT5_IMU] ' + name + ': ' + String(code) + ' ' + String(message));
      }
    });
  } catch (error) {
    errors[index] = 'EXCEPCION';
    console.log('[GT5_IMU] ' + name + ': ' + String(error));
  }
}

export default {
  private: {
    accelState: 'A: SIN INICIAR',
    gyroState: 'G: SIN INICIAR',
    accelAxes: 'X: --  Y: --  Z: --',
    gyroAxes: 'X: --  Y: --  Z: --',
    totals: 'Muestras A:0 G:0',
    rates: 'Callbacks A:-- G:-- Hz',
    hint: 'Mueve y gira la muneca'
  },

  onShow: function () {
    this.startReading();
  },

  onHide: function () {
    this.stopReading();
  },

  onDestroy: function () {
    cleanup();
  },

  startReading: function () {
    cleanup();
    counts = [0, 0];
    previousCounts = [0, 0];
    lastMs = [0, 0];
    values = [null, null];
    errors = ['', ''];
    startMs = Date.now();
    rateMs = startMs;
    active = true;
    this.rates = 'Callbacks A:-- G:-- Hz';
    this.hint = 'Mueve y gira la muneca';

    subscribe(0, 'subscribeAccelerometer', generation);
    subscribe(1, 'subscribeGyroscope', generation);
    this.refresh();
    var page = this;
    // La pantalla se actualiza a 4 Hz; los callbacks se cuentan por separado.
    timer = setInterval(function () { page.refresh(); }, 250);
  },

  refresh: function () {
    if (!active) { return; }
    var now = Date.now();
    this.accelState = 'A: ' + status(0, now);
    this.gyroState = 'G: ' + status(1, now);
    this.accelAxes = axes(values[0]);
    this.gyroAxes = axes(values[1]);
    this.totals = 'Muestras A:' + counts[0] + ' G:' + counts[1];
    var elapsed = now - rateMs;
    if (elapsed >= 1000) {
      var accelHz = (counts[0] - previousCounts[0]) * 1000 / elapsed;
      var gyroHz = (counts[1] - previousCounts[1]) * 1000 / elapsed;
      this.rates = 'Callbacks A:' + accelHz.toFixed(1) + ' G:' + gyroHz.toFixed(1) + ' Hz';
      previousCounts = [counts[0], counts[1]];
      rateMs = now;
    }
  },

  stopReading: function () {
    cleanup();
    this.accelState = 'A: PAUSA';
    this.gyroState = 'G: PAUSA';
    this.rates = 'Callbacks A:-- G:-- Hz';
    this.hint = 'Iniciar reinicia la prueba';
  }
};
