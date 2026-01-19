package com.tp3.rpc;

import org.apache.xmlrpc.server.PropertyHandlerMapping;
import org.apache.xmlrpc.webserver.WebServer;

public class App {

  public static void main(String[] args) throws Exception {
    // Default service port (can be overridden via environment variable).
    int port = 9000;

    String envPort = System.getenv("RPC_SERVICE_PORT");
    if (envPort != null && !envPort.isBlank()) {
      port = Integer.parseInt(envPort);
    }

    // Apache XML-RPC WebServer binds to 0.0.0.0 by default.
    WebServer webServer = new WebServer(port);

    // Register public XML-RPC handlers.
    // Using "default" means methods are exposed as: default.<methodName>()
    PropertyHandlerMapping phm = new PropertyHandlerMapping();
    phm.addHandler("default", FxHandler.class);

    webServer.getXmlRpcServer().setHandlerMapping(phm);

    // Start serving requests.
    webServer.start();
    System.out.println("[rpc-service-java] XML-RPC listening at http://0.0.0.0:" + port + "/RPC2");
  }
}