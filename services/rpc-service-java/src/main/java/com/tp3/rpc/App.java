package com.tp3.rpc;

import org.apache.xmlrpc.server.PropertyHandlerMapping;
import org.apache.xmlrpc.webserver.WebServer;

public class App {
  public static void main(String[] args) throws Exception {
    int port = 9000;
    String envPort = System.getenv("RPC_SERVICE_PORT");
    if (envPort != null && !envPort.isBlank()) port = Integer.parseInt(envPort);

    WebServer webServer = new WebServer(port);

    PropertyHandlerMapping phm = new PropertyHandlerMapping();
    // Regista métodos "top-level": client.get_eur_usd_rate()
    phm.addHandler("default", FxHandler.class);

    webServer.getXmlRpcServer().setHandlerMapping(phm);

    webServer.start();
    System.out.println("[rpc-service-java] XML-RPC a ouvir em http://0.0.0.0:" + port + "/RPC2");
  }
}