export type TransactionStatus =
  | 'OK'
  | 'BLOQUEADO'
  | 'SIN_SALDO'
  | 'ERROR_PIN'
  | 'TARJETA_NO_REGISTRADA'
  | 'DATOS_INVALIDOS';

export interface Alumno {
  dni: number;
  nombre_completo: string;
  pin: string;
  fecha_registro?: string;
}

export interface Cuenta {
  id: number;
  dni_alumno: number;
  saldo: number;
  fecha_registro?: string;
}

export interface CuentaDetallada extends Cuenta {
  alumno_id: number;
  dni: string;
  nombre_completo: string;
  pin?: string;
}

export interface Tarjeta {
  id: number;
  uid: string;
  uid_hardware?: string | null;
  cuenta_id: number;
  intentos_fallidos: number;
  bloqueado: number;
  activa: number;
  fecha_registro?: string;
}

export interface TarjetaConCuenta extends Tarjeta {
  alumno_id: number;
  nombre_completo: string;
  dni: string;
  saldo: number;
  pin: string;
}

export interface TarjetaResumen {
  id: number;
  uid: string;
  cuenta_id: number;
  intentos_fallidos: number;
  bloqueado: number;
  activa: number;
  nombre_completo: string;
  dni?: string;
  saldo: number;
  fecha_registro?: string;
}

export interface TarjetaItem {
  uid: string;
  bloqueado: number;
  activa: number;
  intentos_fallidos: number;
}

export interface AlumnoConTarjetas {
  dni: string;
  nombre_completo: string;
  saldo: number;
  cuenta_id: number;
  fecha_registro?: string;
  tarjetas: TarjetaItem[];
}

export interface Transaccion {
  id: number;
  cuenta_id: number | null;
  tarjeta_uid: string | null;
  monto: number;
  estado: string;
  saldo_restante: number | null;
  fecha_registro?: string;
  created_at?: string;
  alumno_nombre?: string;
  alumno_dni?: string;
}

export interface TransactionRequest {
  uid: string;
  pin: string;
  monto: number;
}

export interface TransactionResponse {
  success: boolean;
  status: TransactionStatus;
  message: string;
  alumno?: string;
  dni?: string;
  monto?: number;
  saldoRestante?: number;
  saldoActual?: number;
  intentosRestantes?: number;
  transaccionId?: number;
}

export interface RechargeRequest {
  cuenta_id?: number;
  dni?: string;
  uid?: string;
  monto: number;
}

export interface RegisterCardRequest {
  dni: string;
  pin?: string;
  uid: string;
  nombre_completo?: string;
}

export interface RegisterStudentRequest {
  dni: string | number;
  nombre_completo: string;
  pin?: string;
  saldo_inicial?: number;
  uid?: string;
}

export interface UpdateStudentRequest {
  nombre_completo?: string;
  pin?: string;
}

export interface SystemStats {
  totalAlumnos: number;
  totalTarjetas: number;
  totalTarjetasBloqueadas: number;
  saldoTotal: number;
  ventasHoy: number;
  recargasHoy: number;
  transaccionesHoy: number;
}

// Compatibilidad
export type Account = CuentaDetallada;
export type Card = Tarjeta;
export type CardWithAccount = TarjetaConCuenta;
export type CardOverview = TarjetaResumen;
export type Transaction = Transaccion;
