#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <I2CKeyPad.h>
#include <LiquidCrystal_I2C.h>
#include <MFRC522.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <Wire.h>

#define LCD_ADDR 0x27
#define KEY_ADDR 0x20

#define SS_PIN 5
#define RST_PIN 4
#define BUZZER_PIN 2
#define LED_GREEN 13
#define LED_RED 14

const char* ssid = "SSID-WIFI";
const char* password = "WIFI-PASSWORD";

const char* statusURL = "https://tudominio-o-ip-con-puerto/api/status";
const char* alumnoURL = "https://tudominio-o-ip-con-puerto/api/admin/alumno/";
const char* registerURL
    = "https://tudominio-o-ip-con-puerto/api/admin/registrar-tarjeta";
const char* rechargeURL
    = "https://tudominio-o-ip-con-puerto/api/admin/recargar";
const char* unlockURL
    = "https://tudominio-o-ip-con-puerto/api/admin/desbloquear-todo";

LiquidCrystal_I2C lcd(LCD_ADDR, 20, 4);
I2CKeyPad teclado(KEY_ADDR);
MFRC522 rfid(SS_PIN, RST_PIN);

char mapeoTeclas[19] = "123A456B789C*0#D";

void beep(int count, int durationMs, int pauseMs, int freq = 2000)
{
  for (int i = 0; i < count; i++) {
    tone(BUZZER_PIN, freq, durationMs);
    delay(durationMs);
    noTone(BUZZER_PIN);
    if (i < count - 1) {
      delay(pauseMs);
    }
  }
}

void printLine(uint8_t row, const String& text)
{
  lcd.setCursor(0, row);
  String padded = text;
  while (padded.length() < 20) {
    padded += " ";
  }
  lcd.print(padded.substring(0, 20));
}

void mostrarMenuPrincipal()
{
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
  printLine(0, "  CREDI-ADMIN v1.0  ");
  printLine(1, "A:Asignar B:Recargar");
  printLine(2, "C:Consult D:Desbloq ");
  printLine(3,
      WiFi.status() == WL_CONNECTED ? "Wi-Fi: Conectado"
                                    : "Wi-Fi: Desconectado");
}

String esperarTecla(unsigned long timeoutMs = 25000)
{
  unsigned long start = millis();
  while (millis() - start < timeoutMs) {
    if (teclado.isPressed()) {
      uint8_t indice = teclado.getKey();
      if (indice < 16) {
        char tecla = mapeoTeclas[indice];
        beep(1, 40, 0);
        delay(150);
        return String(tecla);
      }
    }
    delay(20);
  }
  return "";
}

String capturarTexto(const String& titulo, const String& prompt, uint8_t maxLen,
    bool esPassword = false, const String& valorInicial = "")
{
  String texto = valorInicial;
  printLine(0, titulo);
  printLine(1, prompt);
  printLine(3, "*:Borrar   #:Aceptar");

  String mostrar = esPassword ? String(texto.length(), '*') : texto;
  printLine(2, "[" + mostrar + "_]");

  unsigned long start = millis();
  while (millis() - start < 35000) {
    if (teclado.isPressed()) {
      uint8_t indice = teclado.getKey();
      if (indice < 16) {
        char tecla = mapeoTeclas[indice];
        start = millis();

        if (tecla == '*') {
          if (texto.length() > 0) {
            texto.remove(texto.length() - 1);
            beep(1, 40, 0);
          } else {
            return "";
          }
        } else if (tecla == '#') {
          if (texto.length() > 0) {
            beep(1, 60, 0);
            return texto;
          }
        } else if (isDigit(tecla) || tecla == 'A' || tecla == 'B'
            || tecla == 'C' || tecla == 'D') {
          if (texto.length() < maxLen) {
            texto += tecla;
            beep(1, 40, 0);
          }
        }

        String actual = esPassword ? String(texto.length(), '*') : texto;
        printLine(2, "[" + actual + "_]");
        delay(120);
      }
    }
    delay(20);
  }
  return "";
}

bool esperarTarjeta(String& uidHardware)
{
  printLine(1, "Acerque la tarjeta o");
  printLine(2, "sticker al lector...");
  printLine(3, "*: Cancelar         ");

  unsigned long start = millis();
  while (millis() - start < 25000) {
    if (teclado.isPressed()) {
      uint8_t idx = teclado.getKey();
      if (idx < 16 && mapeoTeclas[idx] == '*') {
        beep(1, 40, 0);
        return false;
      }
    }

    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      uidHardware = "";
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10)
          uidHardware += "0";
        uidHardware += String(rfid.uid.uidByte[i], HEX);
      }
      uidHardware.toUpperCase();
      rfid.PICC_HaltA();

      beep(1, 80, 0, 2400);
      printLine(2, "UID: " + uidHardware);
      printLine(3, "Leyendo datos...    ");
      return true;
    }
    delay(40);
  }
  return false;
}

void flujoAsignarTarjeta()
{
  String dni
      = capturarTexto("  ASIGNAR TARJETA   ", "DNI del alumno:     ", 8, false);
  if (dni.length() == 0) {
    return;
  }

  printLine(0, "  ASIGNAR TARJETA   ");
  printLine(1, "Consultando alumno  ");
  printLine(2, "DNI: " + dni);
  printLine(3, "Espere un momento...");

  String nombreAlumno = "Alumno " + dni;
  String pinActual = "1213";

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8);

  HTTPClient http;
  http.begin(client, String(alumnoURL) + dni);
  http.setTimeout(8000);
  http.addHeader("Connection", "close");

  int code = http.GET();
  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, resp)) {
      nombreAlumno = doc["alumno"].as<String>();
    }
  }
  http.end();
  client.stop();

  String pin = capturarTexto("  ASIGNAR TARJETA   ",
      nombreAlumno.substring(0, 20), 6, true, pinActual);
  if (pin.length() == 0) {
    pin = pinActual;
  }

  printLine(0, "  ASIGNAR TARJETA   ");
  String hwUid = "";

  if (!esperarTarjeta(hwUid)) {
    digitalWrite(LED_RED, HIGH);
    beep(2, 80, 80);
    printLine(0, "  ASIGNAR TARJETA   ");
    printLine(1, "Operacion cancelada ");
    printLine(2, "No se detecto tag   ");
    printLine(3, "                    ");
    delay(2000);
    return;
  }

  printLine(0, "  ASIGNAR TARJETA   ");
  printLine(1, "Registrando en BD...");
  printLine(2, "DNI: " + dni);
  printLine(3, "Espere confirmacion ");

  StaticJsonDocument<256> reqDoc;
  reqDoc["dni"] = dni;
  reqDoc["pin"] = pin;
  reqDoc["uid"] = hwUid;
  reqDoc["nombre_completo"] = nombreAlumno;

  String body;
  serializeJson(reqDoc, body);

  client.setInsecure();
  client.setTimeout(8);
  http.begin(client, registerURL);
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Connection", "close");

  code = http.POST(body);
  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<384> doc;
    deserializeJson(doc, resp);

    digitalWrite(LED_GREEN, HIGH);
    beep(2, 100, 60, 2600);
    printLine(0, "  REGISTRO EXITOSO  ");
    printLine(1, doc["alumno"].as<String>().substring(0, 20));
    printLine(2, "Tag vinculado OK!   ");
    printLine(3, "Saldo: S/. " + String(doc["saldo"].as<float>(), 2));
    delay(3500);
  } else {
    digitalWrite(LED_RED, HIGH);
    beep(4, 60, 60);
    printLine(0, " ERROR EN REGISTRO  ");
    printLine(1, "HTTP Code: " + String(code));
    printLine(2, "Revise conexion     ");
    printLine(3, "                    ");
    delay(3000);
  }

  http.end();
  client.stop();
}

void flujoRecargarSaldo()
{
  printLine(0, "   RECARGAR SALDO   ");
  printLine(1, "Acerque tarjeta o   ");
  printLine(2, "presione #: DNI     ");
  printLine(3, "*: Cancelar         ");

  String dni = "";
  String uid = "";

  unsigned long start = millis();
  while (millis() - start < 25000) {
    if (teclado.isPressed()) {
      uint8_t idx = teclado.getKey();
      if (idx < 16) {
        char k = mapeoTeclas[idx];
        if (k == '*')
          return;
        if (k == '#') {
          beep(1, 40, 0);
          dni = capturarTexto(
              "   RECARGAR SALDO   ", "DNI del alumno:     ", 8, false);
          if (dni.length() == 0)
            return;
          break;
        }
      }
    }

    if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
      for (byte i = 0; i < rfid.uid.size; i++) {
        if (rfid.uid.uidByte[i] < 0x10)
          uid += "0";
        uid += String(rfid.uid.uidByte[i], HEX);
      }
      uid.toUpperCase();
      rfid.PICC_HaltA();
      beep(1, 60, 0);
      break;
    }
    delay(30);
  }

  if (dni.length() == 0 && uid.length() == 0)
    return;

  printLine(0, "   RECARGAR SALDO   ");
  printLine(1, "Consultando saldo...");
  printLine(2, dni.length() > 0 ? "DNI: " + dni : "UID: " + uid);
  printLine(3, "                    ");

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8);

  HTTPClient http;
  String urlConsulta = dni.length() > 0 ? (String(alumnoURL) + dni)
                                        : (String(alumnoURL) + uid);

  http.begin(client, urlConsulta);
  http.setTimeout(8000);
  http.addHeader("Connection", "close");

  String nombreAlumno = "Alumno";
  float saldoActual = 0.0;
  int code = http.GET();
  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<256> doc;
    if (!deserializeJson(doc, resp)) {
      nombreAlumno = doc["alumno"].as<String>();
      saldoActual = doc["saldo"].as<float>();
    }
  }
  http.end();
  client.stop();

  printLine(0, "   RECARGAR SALDO   ");
  printLine(1, nombreAlumno.substring(0, 20));
  printLine(2, "Saldo act: S/." + String(saldoActual, 2));
  printLine(3, "A:5 B:10 C:20 D:Otro");

  float montoRecarga = 0.0;
  String opt = esperarTecla(20000);
  if (opt == "A")
    montoRecarga = 5.0;
  else if (opt == "B")
    montoRecarga = 10.0;
  else if (opt == "C")
    montoRecarga = 20.0;
  else if (opt == "D") {
    String mStr = capturarTexto(
        "   RECARGAR SALDO   ", "Monto a recargar S/:", 5, false);
    montoRecarga = mStr.toFloat();
  } else {
    return;
  }

  if (montoRecarga <= 0.0)
    return;

  printLine(0, "   RECARGAR SALDO   ");
  printLine(1, "Procesando recarga..");
  printLine(2, "+S/. " + String(montoRecarga, 2));
  printLine(3, "Espere confirmacion ");

  StaticJsonDocument<256> reqDoc;
  if (dni.length() > 0)
    reqDoc["dni"] = dni;
  if (uid.length() > 0)
    reqDoc["uid"] = uid;
  reqDoc["monto"] = montoRecarga;

  String body;
  serializeJson(reqDoc, body);

  client.setInsecure();
  client.setTimeout(8);
  http.begin(client, rechargeURL);
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Connection", "close");

  code = http.POST(body);
  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<256> doc;
    deserializeJson(doc, resp);

    digitalWrite(LED_GREEN, HIGH);
    beep(2, 120, 60, 2400);
    printLine(0, "  RECARGA EXITOSA   ");
    printLine(1, doc["alumno"].as<String>().substring(0, 20));
    printLine(2, "Monto: +S/. " + String(montoRecarga, 2));
    printLine(3, "Nuevo: S/. " + String(doc["nuevoSaldo"].as<float>(), 2));
    delay(3500);
  } else {
    digitalWrite(LED_RED, HIGH);
    beep(4, 60, 60);
    printLine(0, " ERROR EN RECARGA   ");
    printLine(1, "HTTP Code: " + String(code));
    printLine(2, "Verifique cuenta    ");
    printLine(3, "                    ");
    delay(3000);
  }

  http.end();
  client.stop();
}

void flujoConsultarAlumno()
{
  String dni
      = capturarTexto("  CONSULTAR SALDO   ", "DNI del alumno:     ", 8, false);
  if (dni.length() == 0)
    return;

  printLine(0, "  CONSULTAR SALDO   ");
  printLine(1, "Buscando en servidor");
  printLine(2, "DNI: " + dni);
  printLine(3, "Espere un momento...");

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8);

  HTTPClient http;
  http.begin(client, String(alumnoURL) + dni);
  http.setTimeout(8000);
  http.addHeader("Connection", "close");

  int code = http.GET();
  if (code == 200) {
    String resp = http.getString();
    StaticJsonDocument<256> doc;
    deserializeJson(doc, resp);

    digitalWrite(LED_GREEN, HIGH);
    beep(1, 100, 0, 2200);
    printLine(0, "  DATOS DEL ALUMNO  ");
    printLine(1, doc["alumno"].as<String>().substring(0, 20));
    printLine(2, "DNI: " + doc["dni"].as<String>());
    printLine(3, "Saldo: S/. " + String(doc["saldo"].as<float>(), 2));
    delay(4000);
  } else {
    digitalWrite(LED_RED, HIGH);
    beep(2, 80, 80);
    printLine(0, "  CONSULTAR SALDO   ");
    printLine(1, "Alumno no encontrado");
    printLine(2, "Verifique DNI       ");
    printLine(3, "                    ");
    delay(3000);
  }

  http.end();
  client.stop();
}

void flujoDesbloquearTodo()
{
  printLine(0, "  DESBLOQUEO TOTAL  ");
  printLine(1, "Desbloqueando...");
  printLine(2, "Espere confirmacion ");
  printLine(3, "                    ");

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8);

  HTTPClient http;
  http.begin(client, unlockURL);
  http.setTimeout(8000);
  http.addHeader("Connection", "close");

  int code = http.POST("");
  if (code == 200) {
    digitalWrite(LED_GREEN, HIGH);
    beep(2, 80, 50, 2600);
    printLine(0, "  DESBLOQUEO TOTAL  ");
    printLine(1, "Operacion exitosa   ");
    printLine(2, "Todas las tarjetas  ");
    printLine(3, "fueron reactivadas  ");
    delay(3000);
  } else {
    digitalWrite(LED_RED, HIGH);
    beep(4, 60, 60);
    printLine(0, " ERROR EN OPERACION ");
    printLine(1, "HTTP Code: " + String(code));
    printLine(2, "Revise conexion     ");
    printLine(3, "                    ");
    delay(3000);
  }

  http.end();
  client.stop();
}

void setup()
{
  Serial.begin(115200);

  Wire.begin();
  lcd.init();
  lcd.backlight();

  teclado.begin();

  SPI.begin();
  rfid.PCD_Init();

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_GREEN, OUTPUT);
  pinMode(LED_RED, OUTPUT);

  noTone(BUZZER_PIN);
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);

  printLine(0, "  CREDI-ADMIN v1.0  ");
  printLine(1, "Estacion de Control ");
  printLine(2, "Coded with love by: ");
  printLine(3, "Fernando Espejo.");
  delay(1200);

  printLine(0, "  CREDI-ADMIN v1.0  ");
  printLine(1, "");
  printLine(2, "Conectando a la ");
  printLine(3, "red WiFi...");

  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.setSleep(false);
  WiFi.begin(ssid, password);

  unsigned long startWifi = millis();
  while (
      (WiFi.status() != WL_CONNECTED || WiFi.localIP() == IPAddress(0, 0, 0, 0))
      && millis() - startWifi < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED
      && WiFi.localIP() != IPAddress(0, 0, 0, 0)) {
    Serial.print("Wi-Fi Conectado. IP ESP32: ");
    Serial.println(WiFi.localIP());

    printLine(0, "  CREDI-ADMIN v1.0  ");
    printLine(1, "");
    printLine(2, "Comprobando conexion");
    printLine(3, "al servidor...");

    WiFiClientSecure client;
    client.setInsecure();
    client.setTimeout(8);

    HTTPClient http;
    http.begin(client, statusURL);
    http.setTimeout(8000);
    http.addHeader("Connection", "close");

    int code = http.GET();
    if (code == 200) {
      digitalWrite(LED_GREEN, HIGH);
      beep(1, 200, 0, 2600);
      printLine(0, "  SERVIDOR ONLINE   ");
      printLine(1, "Servidor activo     ");
      printLine(2, "Listo para operar!  ");
      printLine(3, "                    ");
      delay(2000);
    } else {
      digitalWrite(LED_RED, HIGH);
      beep(4, 60, 60);
      printLine(0, " ERROR DE CONEXION  ");
      printLine(1, "HTTP Code: " + String(code));
      printLine(2, "IP: " + WiFi.localIP().toString());
      printLine(3, "                    ");
      delay(3000);
    }
    http.end();
    client.stop();
  } else {
    digitalWrite(LED_RED, HIGH);
    beep(4, 60, 60);
    printLine(0, "    ERROR DE RED    ");
    printLine(1, "No conecto a WiFi   ");
    printLine(2, "Revise SSID/Clave   ");
    printLine(3, "                    ");
    delay(3000);
  }

  beep(2, 60, 60);
  mostrarMenuPrincipal();
}

void loop()
{
  if (WiFi.status() != WL_CONNECTED) {
    WiFi.reconnect();
  }

  if (teclado.isPressed()) {
    uint8_t indice = teclado.getKey();
    if (indice < 16) {
      char tecla = mapeoTeclas[indice];
      beep(1, 40, 0);

      if (tecla == 'A') {
        flujoAsignarTarjeta();
        mostrarMenuPrincipal();
      } else if (tecla == 'B') {
        flujoRecargarSaldo();
        mostrarMenuPrincipal();
      } else if (tecla == 'C') {
        flujoConsultarAlumno();
        mostrarMenuPrincipal();
      } else if (tecla == 'D') {
        flujoDesbloquearTodo();
        mostrarMenuPrincipal();
      }
    }
  }

  delay(30);
}
