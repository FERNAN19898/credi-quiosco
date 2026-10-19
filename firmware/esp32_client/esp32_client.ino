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
const char* transactionURL
    = "https://tudominio-o-ip-con-puerto/api/transaccion";

LiquidCrystal_I2C lcd(LCD_ADDR, 20, 4);
I2CKeyPad teclado(KEY_ADDR);
MFRC522 rfid(SS_PIN, RST_PIN);

char mapeoTeclas[19] = "123A456B789C*0#D";
float montoActual = 2.50;

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

void mostrarReposo()
{
  digitalWrite(LED_GREEN, LOW);
  digitalWrite(LED_RED, LOW);
  printLine(0, "    CREDI QUIOSCO   ");
  printLine(1, "Acerque su tarjeta  ");
  printLine(2, "Se cobrara: S/. " + String(montoActual, 2));
  printLine(3,
      WiFi.status() == WL_CONNECTED ? "Wi-Fi: Conectado"
                                    : "Wi-Fi: Desconectado");
}

String readUid()
{
  String uid = "";
  for (byte i = 0; i < rfid.uid.size; i++) {
    if (rfid.uid.uidByte[i] < 0x10)
      uid += "0";
    uid += String(rfid.uid.uidByte[i], HEX);
  }
  uid.toUpperCase();
  rfid.PICC_HaltA();

  Serial.println("=================================");
  Serial.print("Tarjeta detectada. UID: ");
  Serial.println(uid);
  return uid;
}

String capturarPin()
{
  String pin = "";
  printLine(0, "    CREDI QUIOSCO   ");
  printLine(1, "Tarjeta detectada   ");
  printLine(2, "Ingrese PIN: _      ");
  printLine(3, "*:Borrar  #:Aceptar ");

  unsigned long start = millis();
  while (millis() - start < 20000) {
    if (teclado.isPressed()) {
      uint8_t indice = teclado.getKey();
      if (indice < 16) {
        char tecla = mapeoTeclas[indice];
        start = millis();

        if (tecla == '*') {
          if (pin.length() > 0) {
            pin.remove(pin.length() - 1);
            beep(1, 40, 0);
          }
        } else if (tecla == '#') {
          if (pin.length() > 0) {
            beep(1, 60, 0);
            return pin;
          }
        } else if (isDigit(tecla)) {
          if (pin.length() < 6) {
            pin += tecla;
            beep(1, 40, 0);
          }
        }

        String masked = "";
        for (size_t i = 0; i < pin.length(); i++) {
          masked += "*";
        }
        printLine(2, "Ingrese PIN: " + masked + "_");
        delay(120);
      }
    }
    delay(20);
  }
  return "";
}

void procesarRespuesta(const String& payload)
{
  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, payload);

  if (err) {
    digitalWrite(LED_RED, HIGH);
    beep(4, 50, 50);
    printLine(0, "    ERROR INTERNO    ");
    printLine(1, "JSON Invalido       ");
    printLine(2, "Consulte soporte    ");
    printLine(3, "                    ");
    delay(3000);
    return;
  }

  const char* status = doc["status"] | "ERROR";

  if (strcmp(status, "OK") == 0) {
    digitalWrite(LED_GREEN, HIGH);
    beep(1, 250, 0, 2600);
    const char* alumno = doc["alumno"] | "Alumno";
    float saldo = doc["saldoRestante"] | 0.0;
    printLine(0, "    PAGO EXITOSO    ");
    printLine(1, String(alumno));
    printLine(2, "Cobro: S/. " + String(montoActual, 2));
    printLine(3, "Saldo: S/. " + String(saldo, 2));
  } else if (strcmp(status, "ERROR_PIN") == 0) {
    digitalWrite(LED_RED, HIGH);
    beep(2, 100, 100, 1200);
    int intentos = doc["intentosRestantes"] | 0;
    printLine(0, "    PIN INCORRECTO   ");
    printLine(1, "Clave no coincide   ");
    printLine(2, "Quedan " + String(intentos) + " intentos  ");
    printLine(3, "Reintente de nuevo  ");
  } else if (strcmp(status, "SIN_SALDO") == 0) {
    digitalWrite(LED_RED, HIGH);
    beep(3, 100, 100, 1000);
    float saldoAct = doc["saldoActual"] | 0.0;
    printLine(0, " SALDO INSUFICIENTE ");
    printLine(1, "Recargue su cuenta  ");
    printLine(2, "Saldo act: S/. " + String(saldoAct, 2));
    printLine(3, "Operacion cancelada ");
  } else if (strcmp(status, "BLOQUEADO") == 0) {
    digitalWrite(LED_RED, HIGH);
    beep(1, 800, 0, 700);
    printLine(0, " TARJETA BLOQUEADA  ");
    printLine(1, "Acuda a direccion   ");
    printLine(2, "para desbloquearla. ");
    printLine(3, "                    ");
  } else if (strcmp(status, "ONLINE") == 0) {
    digitalWrite(LED_GREEN, HIGH);
    beep(1, 250, 0, 2600);
    printLine(0, "  SERVIDOR ONLINE   ");
    printLine(1, "Servidor activo,    ");
    printLine(2, "Listo para usar!    ");
    printLine(3, "                    ");
  } else {
    digitalWrite(LED_RED, HIGH);
    beep(4, 60, 60, 850);
    const char* msg = doc["message"] | "Error desconocido";
    printLine(0, "  ERROR EN COBRO    ");
    printLine(1, String(status));
    printLine(2, String(msg));
    printLine(3, "Reintente luego     ");
  }

  delay(3500);
}

void enviarTransaccion(const String& uid, const String& pin)
{
  if (WiFi.status() != WL_CONNECTED
      || WiFi.localIP() == IPAddress(0, 0, 0, 0)) {
    digitalWrite(LED_RED, HIGH);
    beep(4, 50, 50);
    printLine(0, "    ERROR DE RED    ");
    printLine(1, "Wi-Fi no conectado  ");
    printLine(2, "Verifique conexion  ");
    printLine(3, "                    ");
    delay(2500);
    return;
  }

  printLine(0, "    CREDI QUIOSCO   ");
  printLine(1, "Procesando pago...  ");
  printLine(2, "Monto: S/. " + String(montoActual, 2));
  printLine(3, "Espere un momento.  ");

  WiFiClientSecure client;
  client.setInsecure();
  client.setTimeout(8);

  HTTPClient http;
  http.begin(client, transactionURL);
  http.setTimeout(8000);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Connection", "close");

  StaticJsonDocument<256> reqDoc;
  reqDoc["uid"] = uid;
  reqDoc["pin"] = pin;
  reqDoc["monto"] = montoActual;

  String body;
  serializeJson(reqDoc, body);

  Serial.println("---------------------------------");
  Serial.print("POST URL: ");
  Serial.println(transactionURL);
  Serial.print("Payload enviado: ");
  Serial.println(body);

  int code = http.POST(body);
  if (code > 0) {
    String response = http.getString();
    Serial.print("Respuesta HTTP (");
    Serial.print(code);
    Serial.print("): ");
    Serial.println(response);
    procesarRespuesta(response);
  } else {
    Serial.print("Error conexion HTTP: ");
    Serial.println(code);
    digitalWrite(LED_RED, HIGH);
    beep(4, 60, 60);
    printLine(0, " ERROR DE CONEXION  ");
    printLine(1, "HTTP Code: " + String(code));
    printLine(2, "Contacte soporte    ");
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

  printLine(0, "    CREDI QUIOSCO   ");
  printLine(1, "");
  printLine(2, "Coded with love by: ");
  printLine(3, "Fernando Espejo.");
  delay(1000);

  printLine(0, "    CREDI QUIOSCO   ");
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
    Serial.print("Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    printLine(0, "    CREDI QUIOSCO   ");
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

    Serial.print("GET a ");
    Serial.println(statusURL);

    int code = http.GET();
    if (code > 0) {
      String response = http.getString();
      Serial.print("Respuesta servidor status: ");
      Serial.println(response);
      procesarRespuesta(response);
    } else {
      Serial.print("Error conexion statusURL: code ");
      Serial.println(code);
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
    Serial.println("Tiempo agotado conectando a WiFi.");
    digitalWrite(LED_RED, HIGH);
    beep(4, 60, 60);
    printLine(0, "    ERROR DE RED    ");
    printLine(1, "No conecto a WiFi   ");
    printLine(2, "Revise SSID/Clave   ");
    printLine(3, "                    ");
    delay(3000);
  }

  beep(2, 60, 60);
  mostrarReposo();
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
      if (tecla == 'A') {
        montoActual = round((montoActual + 0.10) * 100.0) / 100.0;
        beep(1, 40, 0);
        mostrarReposo();
        delay(120);
      } else if (tecla == 'B') {
        montoActual = round((montoActual + 0.50) * 100.0) / 100.0;
        beep(1, 40, 0);
        mostrarReposo();
        delay(120);
      } else if (tecla == 'C') {
        if (montoActual > 0.15) {
          montoActual = round((montoActual - 0.10) * 100.0) / 100.0;
        } else {
          montoActual = 0.10;
        }
        beep(1, 40, 0);
        mostrarReposo();
        delay(120);
      } else if (tecla == 'D') {
        if (montoActual > 0.55) {
          montoActual = round((montoActual - 0.50) * 100.0) / 100.0;
        } else {
          montoActual = 0.10;
        }
        beep(1, 40, 0);
        mostrarReposo();
        delay(120);
      } else if (tecla == '*') {
        montoActual = 1.00;
        beep(1, 60, 0);
        mostrarReposo();
        delay(120);
      }
    }
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    delay(30);
    return;
  }

  String uid = readUid();
  beep(1, 80, 0);

  String pin = capturarPin();
  if (pin.length() > 0) {
    enviarTransaccion(uid, pin);
  } else {
    digitalWrite(LED_RED, HIGH);
    beep(2, 80, 80);
    printLine(0, "    CREDIQUIOSCO    ");
    printLine(1, "Operacion cancelada ");
    printLine(2, "Tiempo agotado      ");
    printLine(3, "                    ");
    delay(2000);
  }

  mostrarReposo();
}
