-- CreateTable
CREATE TABLE "product" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(500) NOT NULL,
    "shortdescription" TEXT,
    "fulldescription" TEXT,
    "fragnancetype" VARCHAR(255),
    "volume" VARCHAR(50),
    "origincountry" VARCHAR(255),
    "organiccertified" BOOLEAN,
    "supplierid" INTEGER,
    "soldquantity" INTEGER,
    "availablequantity" INTEGER,
    "quantity" INTEGER,
    "ecompublishedquantity" INTEGER,
    "productstatus" VARCHAR(255),
    "ponumber" VARCHAR(255),
    "puc" VARCHAR(255),
    "suppliername" VARCHAR(255),
    "serialnumber" VARCHAR(255),
    "averagerating" DECIMAL(2,1),
    "discount" INTEGER,
    "price" DECIMAL(10,2),
    "orderedquantity" INTEGER,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "ingredients" TEXT,
    "usage" TEXT,
    "extractionmethod" VARCHAR(100),
    "note" VARCHAR(150),
    "shelflife" VARCHAR(150),
    "wax_type" VARCHAR(150),
    "burn_time" VARCHAR(150),
    "scent_profile" VARCHAR(100),
    "container_material" VARCHAR(100),
    "candle_dimensions" TEXT,
    "planter_material" TEXT,
    "drainage_hole" BOOLEAN,
    "suitable_for" TEXT,
    "planter_dimensions" TEXT,
    "plant_included" BOOLEAN,
    "art_type" TEXT,
    "frame_included" BOOLEAN,
    "art_dimensions" TEXT,
    "orientation" TEXT,
    "artist_name" TEXT,
    "isactive" BOOLEAN,
    "isdealoftheday" BOOLEAN DEFAULT false,
    "category" VARCHAR(255),
    "subcategory" VARCHAR(255),
    "large" TEXT[],
    "medium" TEXT[],
    "small" TEXT[],

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock" (
    "id" SERIAL NOT NULL,
    "puc" VARCHAR(500),
    "category" VARCHAR(500),
    "subcategory" VARCHAR(500),
    "brand" VARCHAR(500),
    "model" VARCHAR(500),
    "operatingsystem" VARCHAR(500),
    "operatingsystemversion" VARCHAR(500),
    "ram" VARCHAR(500),
    "storagetype" VARCHAR(500),
    "storagecapacity" VARCHAR(500),
    "colour" VARCHAR(500),
    "graphicscard" VARCHAR(500),
    "processor" VARCHAR(500),
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "createdby" INTEGER,
    "modifiedby" INTEGER,
    "serialnumber" VARCHAR(500),
    "stockstatus" VARCHAR(500) NOT NULL DEFAULT 'Available',
    "manufacturedyear" BIGINT,
    "releaseyear" BIGINT,
    "isdeleted" BOOLEAN DEFAULT false,
    "isarchive" BOOLEAN DEFAULT false,
    "removefromrecyclebin" BOOLEAN DEFAULT false,
    "ecompublish" BOOLEAN DEFAULT false,
    "productname" VARCHAR(500),
    "rfid" VARCHAR(500),
    "nfc" VARCHAR(500),
    "orderid" VARCHAR(500),
    "invoiceurl" VARCHAR(500),
    "location" VARCHAR(500),
    "solddate" BIGINT,
    "assetlocation" VARCHAR(200),
    "rfidscannedtime" BIGINT,
    "orderlinenumber" VARCHAR(500),
    "searchtext" tsvector,
    "qrcode" VARCHAR(500),
    "barcode" VARCHAR(500),
    "ewaste" BOOLEAN DEFAULT false,

    CONSTRAINT "stock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "picklist" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(255),
    "value" VARCHAR(255),
    "object" VARCHAR(255),
    "controlledvalue" VARCHAR(255),
    "fieldname" VARCHAR(255),
    "controlledlabel" VARCHAR(255),
    "controlledfieldname" VARCHAR(255),
    "parent" VARCHAR(20),

    CONSTRAINT "pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier" (
    "id" SERIAL NOT NULL,
    "suppliername" VARCHAR(300),
    "supplierphonenumber" BIGINT,
    "supplierlandline" BIGINT,
    "doornumber" VARCHAR(100),
    "streetname" TEXT,
    "city" VARCHAR(100),
    "state" VARCHAR(100),
    "pincode" DECIMAL,
    "isdeleted" BOOLEAN,
    "modifieddate" BIGINT,
    "createddate" BIGINT,
    "gstnumber" VARCHAR(500),
    "supplieremail" VARCHAR(500),
    "suppliercode" VARCHAR(5),
    "suppliertype" VARCHAR(255) NOT NULL DEFAULT 'local',
    "country" VARCHAR(255),

    CONSTRAINT "supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchaseorder" (
    "id" SERIAL NOT NULL,
    "ponumber" VARCHAR(500) NOT NULL,
    "companyname" VARCHAR(500),
    "companyaddress" VARCHAR(500),
    "contactname" VARCHAR(500),
    "phonenumber" DECIMAL,
    "gstnumber" VARCHAR(500),
    "io_companyname" VARCHAR(500),
    "io_companyaddress" VARCHAR(500),
    "io_contactname" VARCHAR(500),
    "io_phonenumber" DECIMAL,
    "io_gstnumber" VARCHAR(500),
    "dt_companyname" VARCHAR(500),
    "dt_companyaddress" VARCHAR(500),
    "dt_contactname" VARCHAR(500),
    "dt_phonenumber" DECIMAL,
    "dt_gstnumber" VARCHAR(500),
    "supplierid" INTEGER,
    "subtotal" DECIMAL,
    "discount" DECIMAL,
    "sgst" DECIMAL,
    "cgst" DECIMAL,
    "payabletaxamount" DECIMAL,
    "total" DECIMAL,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "product" JSONB,
    "po_status" VARCHAR(500),
    "supplieraddress" VARCHAR(500),
    "suppliercompanyname" VARCHAR(500),
    "supplierphonenumber" DECIMAL,
    "suppliergstnumber" VARCHAR(500),
    "instructions" TEXT,
    "fileurl" VARCHAR(500),
    "invoiceurl" VARCHAR(500)[],
    "sameasinvoice" BOOLEAN,
    "prnumber" VARCHAR(500),
    "paymentterms" VARCHAR(500),
    "overduedate" BIGINT,
    "comments" TEXT,
    "suppliertype" VARCHAR(255) NOT NULL DEFAULT 'local',

    CONSTRAINT "purchaseorder_pkey" PRIMARY KEY ("ponumber")
);

-- CreateTable
CREATE TABLE "purchaserequest" (
    "id" SERIAL NOT NULL,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "prstatus" VARCHAR(500) DEFAULT 'In Progress',
    "companyname" VARCHAR(500),
    "companyaddress" VARCHAR(500),
    "contactname" VARCHAR(500),
    "phonenumber" BIGINT,
    "gstnumber" VARCHAR(500),
    "companymail" VARCHAR(500),
    "supplierid" INTEGER,
    "prurl" VARCHAR(500),
    "prdata" JSONB,
    "prnumber" VARCHAR(500) NOT NULL,
    "supplieremail" VARCHAR(200),

    CONSTRAINT "purchaserequest_pkey" PRIMARY KEY ("prnumber")
);

-- CreateTable
CREATE TABLE "address" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER,
    "name" VARCHAR(100),
    "mobilenumber" DECIMAL,
    "pincode" DECIMAL,
    "doornumber" VARCHAR(100),
    "address" TEXT,
    "landmark" VARCHAR(100),
    "state" VARCHAR(100),
    "city" VARCHAR(100),
    "modifieddate" BIGINT,
    "createddate" BIGINT,

    CONSTRAINT "pk_address" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart" (
    "id" SERIAL NOT NULL,
    "productid" BIGINT,
    "userid" INTEGER,
    "createddate" BIGINT,
    "quantity" DECIMAL,
    "iscart" BOOLEAN DEFAULT false,
    "iswishlist" BOOLEAN DEFAULT false,
    "modifieddate" BIGINT,

    CONSTRAINT "cart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "currency" VARCHAR(5) NOT NULL,
    "exchange_rate" DECIMAL(10,4),
    "last_updated" TIMESTAMP(6),

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("currency")
);

-- CreateTable
CREATE TABLE "inventoryusers" (
    "id" SERIAL NOT NULL,
    "useremail" VARCHAR(255),
    "userpassword" VARCHAR(255),
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "role" VARCHAR(500),
    "usersphonenumber" BIGINT,
    "firstname" VARCHAR(255),
    "lastname" VARCHAR(255),
    "location" VARCHAR(500),
    "fcmid" VARCHAR(400),
    "sessiontoken" VARCHAR(255),
    "resettoken" VARCHAR(255),
    "resettokenexpires" BIGINT,

    CONSTRAINT "inventoryusers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "locationhistory" (
    "id" SERIAL NOT NULL,
    "location" VARCHAR(500),
    "lastlocation" VARCHAR(500),
    "scannedlocation" VARCHAR(500),
    "modifieddate" BIGINT,
    "createddate" BIGINT,
    "stockid" INTEGER,
    "scannedtime" BIGINT
);

-- CreateTable
CREATE TABLE "logistics_costs" (
    "region" TEXT,
    "logistics_cost_qar" DOUBLE PRECISION
);

-- CreateTable
CREATE TABLE "notes" (
    "id" SERIAL NOT NULL,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "quotenumber" VARCHAR(500),
    "comment" TEXT,
    "title" VARCHAR(500),
    "ispinned" BOOLEAN DEFAULT false
);

-- CreateTable
CREATE TABLE "orderline" (
    "id" SERIAL NOT NULL,
    "orderid" INTEGER,
    "productid" BIGINT,
    "userid" INTEGER,
    "addressid" INTEGER,
    "productamount" DECIMAL,
    "discountamount" DECIMAL,
    "orderamount" DECIMAL,
    "quantity" INTEGER,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "merchanttransactionid" VARCHAR(250),
    "productname" VARCHAR(500),
    "productcategory" VARCHAR(500),
    "productcolour" VARCHAR(500),
    "readytodispatchdate" BIGINT,
    "delivereddate" BIGINT,
    "cancelleddate" BIGINT,
    "returneddate" BIGINT,
    "orderstatus" VARCHAR(500),
    "uniqueordderid" VARCHAR(500),
    "orderlinenumber" VARCHAR(500),
    "deliveryfrom" VARCHAR(500),
    "location" VARCHAR(500),
    "dispatcheddate" BIGINT,
    "ordereddate" BIGINT,
    "paymentfaileddate" BIGINT,

    CONSTRAINT "orderline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER,
    "addressid" INTEGER,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "orderamount" DECIMAL,
    "orderid" VARCHAR(500),
    "orderstatus" VARCHAR(500),
    "delivereddate" BIGINT,
    "cancelleddate" BIGINT,
    "returneddate" BIGINT,
    "quantity" INTEGER,
    "transactionid" VARCHAR(500),
    "readytodispatchdate" BIGINT,
    "dispatcheddate" BIGINT,
    "productamount" DECIMAL,
    "discountamount" DECIMAL,
    "deliveryfrom" VARCHAR(200),
    "orderprocessingtime" BIGINT,
    "ispaymentsucceed" BOOLEAN DEFAULT false,
    "merchanttransactionid" VARCHAR(250),
    "productid" INTEGER[],
    "paymentfaileddate" BIGINT,
    "searchtext" tsvector,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "permissionname" VARCHAR(255) NOT NULL,
    "permissionset" JSONB NOT NULL,
    "role" VARCHAR(255) NOT NULL,
    "createddate" BIGINT,
    "modifieddate" BIGINT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poinvoice" (
    "id" SERIAL NOT NULL,
    "invoiceamount" DECIMAL,
    "ponumber" VARCHAR(500),
    "invoicedate" BIGINT,
    "invoicenumber" VARCHAR(500),
    "invoiceurl" VARCHAR(500),
    "paymentdata" JSONB,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "balanceamount" DECIMAL,
    "iscreditpayment" BOOLEAN DEFAULT false,
    "paymentduedate" BIGINT,
    "invoicestatus" VARCHAR(100),
    "pototal" DECIMAL,
    "purchaseorderstatus" VARCHAR(500),
    "transportationcharges" DECIMAL(15,2),
    "exchangeamount" DECIMAL(15,2),
    "customdutytaxamount" DECIMAL(15,2),
    "suppliertype" VARCHAR(255),
    "customdutychallanurl" VARCHAR(255),
    "billofentryurl" VARCHAR(255),

    CONSTRAINT "poinvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_markup" (
    "id" BIGSERIAL NOT NULL,
    "category" VARCHAR(255),
    "subcategory" VARCHAR(255),
    "markup_percentage" DECIMAL(5,2),

    CONSTRAINT "pricing_markup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotes" (
    "id" SERIAL NOT NULL,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "status" VARCHAR(500),
    "prnumber" VARCHAR(500),
    "quoteurl" VARCHAR(500),
    "quotenumber" VARCHAR(500),

    CONSTRAINT "quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rating" (
    "id" SERIAL NOT NULL,
    "userid" INTEGER,
    "productid" INTEGER,
    "orderid" INTEGER,
    "starrating" INTEGER,
    "comments" TEXT,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "url" VARCHAR[],
    "usermail" VARCHAR(500),
    "orderlineid" INTEGER
);

-- CreateTable
CREATE TABLE "revoinvoice" (
    "id" SERIAL NOT NULL,
    "companyname" VARCHAR(500),
    "companyaddress" VARCHAR(500),
    "contactname" VARCHAR(500),
    "phonenumber" DECIMAL,
    "gstnumber" VARCHAR(500),
    "customername" VARCHAR(500),
    "customeraddress" VARCHAR(500),
    "customerphonenumber" DECIMAL,
    "invoicedate" BIGINT,
    "invoicenumber" VARCHAR(500) NOT NULL,
    "invoiceurl" VARCHAR(100),
    "invoicedata" JSONB,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "invoicefor" VARCHAR(100),
    "orderid" VARCHAR(500),
    "servicedata" JSONB,
    "gst" VARCHAR(255),
    "taxamount" DECIMAL,
    "discount" DECIMAL,
    "totalorderamount" DECIMAL,
    "ticketnumber" VARCHAR,
    "iscreditpayment" BOOLEAN DEFAULT false,
    "paymentduedate" BIGINT,
    "servicetype" DECIMAL DEFAULT 0,
    "customergstnumber" VARCHAR(20),

    CONSTRAINT "revo_invoice" PRIMARY KEY ("invoicenumber")
);

-- CreateTable
CREATE TABLE "servicecostestimation" (
    "id" SERIAL NOT NULL,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "ticketnumber" VARCHAR(500),
    "estimationurl" VARCHAR(500),
    "estimationstatus" VARCHAR(500),
    "productdata" JSONB,
    "servicedata" JSONB,
    "productcgst" DECIMAL,
    "productsgst" DECIMAL,
    "producttaxamount" DECIMAL,
    "producttotal" DECIMAL(10,2),
    "servicecgst" DECIMAL,
    "servicesgst" DECIMAL,
    "servicetds" DECIMAL,
    "servicetaxamount" DECIMAL,
    "servicetotal" DECIMAL,
    "totalpayableamount" DECIMAL,
    "approvalcomments" TEXT,
    "servicetype" DECIMAL DEFAULT 0,

    CONSTRAINT "servicecostestimation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_orders" (
    "order_id" TEXT,
    "order_date" TEXT,
    "customer_id" TEXT,
    "region" TEXT,
    "product_id" TEXT,
    "product_name" TEXT,
    "quantity" BIGINT,
    "order_value" DOUBLE PRECISION,
    "currency" TEXT,
    "payment_status" TEXT,
    "delivery_status" TEXT
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" SERIAL NOT NULL,
    "ticketnumber" VARCHAR(500),
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "ticketstatus" VARCHAR(500),
    "tikcetcomments" TEXT,
    "assignedto" INTEGER,
    "tickettype" VARCHAR(255) NOT NULL,
    "ticketpriority" VARCHAR(500),
    "transactionid" VARCHAR(255),
    "amount" DECIMAL,
    "paymentmethod" VARCHAR(255),
    "transactiondate" BIGINT,
    "payeremail" VARCHAR(255),
    "issuedescription" TEXT,
    "recipturl" VARCHAR(200),
    "trackingnumber" VARCHAR(255),
    "productname" VARCHAR(255),
    "purchasedate" BIGINT,
    "userid" INTEGER,
    "location" VARCHAR(255),
    "issuetype" VARCHAR(255),
    "servicetype" VARCHAR(255),
    "proceedwithvalueservice" BOOLEAN DEFAULT false,
    "productcategory" VARCHAR(255),
    "productbrand" VARCHAR(255),
    "productmodel" VARCHAR(255),
    "receiversemail" VARCHAR(250),
    "assignedid" INTEGER,
    "approvedcostestimationid" INTEGER,
    "addressid" INTEGER,
    "queuenumber" INTEGER,
    "closeddate" BIGINT,
    "reopenedticketdescription" TEXT,
    "underwarranty" BOOLEAN DEFAULT false,
    "assignedfrom" VARCHAR(200),
    "assigneddate" BIGINT,
    "istransferred" BOOLEAN DEFAULT false,
    "transferredby" VARCHAR(200),
    "isreopend" BOOLEAN DEFAULT false,
    "createdbyid" INTEGER,
    "productid" INTEGER,
    "productdelivereddate" BIGINT,
    "orderlinenumber" VARCHAR(500),
    "searchtext" tsvector
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" SERIAL NOT NULL,
    "transactionid" VARCHAR(500) NOT NULL,
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "transactiondata" JSONB,
    "userid" INTEGER,
    "productid" INTEGER[],
    "merchanttransactionid" VARCHAR(500),
    "name" VARCHAR(500),
    "amount" DECIMAL,
    "mobilenumber" BIGINT,
    "transactionfor" VARCHAR(255),

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("transactionid")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "useremail" VARCHAR(255),
    "userpassword" VARCHAR(255),
    "createddate" BIGINT,
    "modifieddate" BIGINT,
    "usermobilenumber" BIGINT,
    "fcmid" VARCHAR(500),
    "firstname" VARCHAR(500),
    "lastname" VARCHAR(500),
    "gender" VARCHAR(50),
    "gstnumber" VARCHAR(20),
    "isbusinessuser" BOOLEAN,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_puc_key" ON "product"("puc");

-- CreateIndex
CREATE UNIQUE INDEX "unique_serialnumber" ON "stock"("serialnumber");

-- CreateIndex
CREATE UNIQUE INDEX "nfc_id" ON "stock"("nfc");

-- CreateIndex
CREATE UNIQUE INDEX "unique_qrcode_stock" ON "stock"("qrcode");

-- CreateIndex
CREATE UNIQUE INDEX "unique_barcode_stock" ON "stock"("barcode");

-- CreateIndex
CREATE INDEX "idx_stock_category" ON "stock"("category");

-- CreateIndex
CREATE INDEX "idx_stock_createddate" ON "stock"("createddate");

-- CreateIndex
CREATE INDEX "idx_stock_id" ON "stock"("id");

-- CreateIndex
CREATE INDEX "idx_stock_puc" ON "stock"("puc");

-- CreateIndex
CREATE INDEX "idx_stock_stockstatus" ON "stock"("stockstatus");

-- CreateIndex
CREATE INDEX "idx_picklist_id" ON "picklist"("id");

-- CreateIndex
CREATE UNIQUE INDEX "unique_supplier_code" ON "supplier"("suppliercode");

-- CreateIndex
CREATE UNIQUE INDEX "unique_email_inventory_users" ON "inventoryusers"("useremail");

-- CreateIndex
CREATE UNIQUE INDEX "unique_orderlinenumber" ON "orderline"("orderlinenumber");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_orderid" ON "orders"("orderid");

-- CreateIndex
CREATE UNIQUE INDEX "unique_quotenumber" ON "quotes"("quotenumber");

-- CreateIndex
CREATE UNIQUE INDEX "uniqueticketnumber" ON "tickets"("ticketnumber");

-- CreateIndex
CREATE UNIQUE INDEX "unique_email_users" ON "users"("useremail");

-- AddForeignKey
ALTER TABLE "product" ADD CONSTRAINT "fk_supplier" FOREIGN KEY ("supplierid") REFERENCES "supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "fk_orderlinenumber" FOREIGN KEY ("orderlinenumber") REFERENCES "orderline"("orderlinenumber") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "fk_puc" FOREIGN KEY ("puc") REFERENCES "product"("puc") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock" ADD CONSTRAINT "stock_orderid_fkey" FOREIGN KEY ("orderid") REFERENCES "orders"("orderid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchaseorder" ADD CONSTRAINT "fk_prnumber_purchaseorder" FOREIGN KEY ("prnumber") REFERENCES "purchaserequest"("prnumber") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchaseorder" ADD CONSTRAINT "fk_supplierid_purchaseorder_supplier" FOREIGN KEY ("supplierid") REFERENCES "supplier"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "purchaserequest" ADD CONSTRAINT "fk_supplierid_purchaserequest" FOREIGN KEY ("supplierid") REFERENCES "supplier"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "address" ADD CONSTRAINT "fk_userid_address_user" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "fk_quotenumber_notes" FOREIGN KEY ("quotenumber") REFERENCES "quotes"("quotenumber") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orderline" ADD CONSTRAINT "orderline_addressid_fkey" FOREIGN KEY ("addressid") REFERENCES "address"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orderline" ADD CONSTRAINT "orderline_orderid_fkey" FOREIGN KEY ("orderid") REFERENCES "orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orderline" ADD CONSTRAINT "orderline_productid_fkey" FOREIGN KEY ("productid") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orderline" ADD CONSTRAINT "orderline_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_addressid_orders" FOREIGN KEY ("addressid") REFERENCES "address"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_transactionid" FOREIGN KEY ("transactionid") REFERENCES "transaction"("transactionid") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_userid_orders" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "poinvoice" ADD CONSTRAINT "fk_ponumber_invoice" FOREIGN KEY ("ponumber") REFERENCES "purchaseorder"("ponumber") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_prnumber_fkey" FOREIGN KEY ("prnumber") REFERENCES "purchaserequest"("prnumber") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rating" ADD CONSTRAINT "fk_orderline_rating_id" FOREIGN KEY ("orderlineid") REFERENCES "orderline"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "revoinvoice" ADD CONSTRAINT "fk_ticketnumber" FOREIGN KEY ("ticketnumber") REFERENCES "tickets"("ticketnumber") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "revoinvoice" ADD CONSTRAINT "revoinvoice_orderid_fkey" FOREIGN KEY ("orderid") REFERENCES "orders"("orderid") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "servicecostestimation" ADD CONSTRAINT "servicecostestimation_ticketnumber_fkey" FOREIGN KEY ("ticketnumber") REFERENCES "tickets"("ticketnumber") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "fk_orderlinenumber" FOREIGN KEY ("orderlinenumber") REFERENCES "orderline"("orderlinenumber") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_userid_fkey" FOREIGN KEY ("userid") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
